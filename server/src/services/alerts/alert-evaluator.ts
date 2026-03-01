import { prisma } from '../../lib/prisma.js';
import { broadcastAlertTriggered } from '../websocket/ws-server.js';
import {
  evaluatePriceCross,
  evaluatePriceChangePct,
  evaluateVolumeSpike,
  type AlertEvalContext,
} from './alert-types.js';

interface QuoteData {
  symbol: string;
  price: number;
  change: number | null;
  changePercent: number | null;
  volume: number | null;
  avgVolume: number | null;
}

export async function evaluateAlerts(quotes: QuoteData[]) {
  try {
    const alerts = await prisma.alert.findMany({
      where: { enabled: true },
    });

    if (alerts.length === 0) return;

    const quoteMap = new Map(quotes.map(q => [q.symbol, q]));

    for (const alert of alerts) {
      try {
        let condition: any;
        try {
          condition = JSON.parse(alert.condition);
        } catch {
          continue; // Skip alerts with invalid condition JSON
        }

        // For symbol-specific alerts, find the matching quote
        if (alert.symbol) {
          const quote = quoteMap.get(alert.symbol);
          if (!quote) continue;

          const ctx: AlertEvalContext = {
            symbol: alert.symbol,
            currentPrice: quote.price,
            previousPrice: quote.price - (quote.change ?? 0),
            volume: quote.volume ?? 0,
            avgVolume: quote.avgVolume ?? 0,
          };

          let result = { triggered: false, message: '' };

          switch (alert.type) {
            case 'price_cross':
              result = evaluatePriceCross(condition, ctx);
              break;
            case 'price_change_pct':
              result = evaluatePriceChangePct(condition, ctx);
              break;
            case 'volume_spike':
              result = evaluateVolumeSpike(condition, ctx);
              break;
            default:
              continue;
          }

          if (result.triggered) {
            const trigger = await prisma.alertTrigger.create({
              data: {
                alertId: alert.id,
                message: result.message,
                value: String(quote.price),
              },
            });

            broadcastAlertTriggered({
              alertId: alert.id,
              alertName: alert.name,
              type: alert.type,
              symbol: alert.symbol,
              message: result.message,
              value: String(quote.price),
              triggeredAt: trigger.createdAt,
            });

            console.log(`[AlertEvaluator] Alert triggered: ${alert.name} - ${result.message}`);
          }
        }
      } catch (err) {
        console.error(`[AlertEvaluator] Error evaluating alert ${alert.id}:`, err instanceof Error ? err.message : err);
      }
    }
  } catch (err) {
    console.error('[AlertEvaluator] Error:', err instanceof Error ? err.message : err);
  }
}
