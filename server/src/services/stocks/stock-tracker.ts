import { prisma } from '../../lib/prisma.js';
import { getQuotes } from './yahoo-finance.js';
import { broadcastQuotes } from '../websocket/ws-server.js';
import { evaluateAlerts } from '../alerts/alert-evaluator.js';

let intervalId: ReturnType<typeof setInterval> | null = null;
let isRefreshing = false;

async function refreshQuotes() {
  if (isRefreshing) return;
  isRefreshing = true;
  try {
    const tracked = await prisma.trackedStock.findMany();
    if (tracked.length === 0) return;

    const symbols = tracked.map((t) => t.symbol);
    const quotes = await getQuotes(symbols);

    // Batch upsert all quotes in a single transaction (much faster than sequential)
    await prisma.$transaction(
      quotes.map((quote) => {
        const vol = quote.volume != null ? BigInt(Math.round(quote.volume)) : null;
        return prisma.stockQuote.upsert({
          where: { symbol: quote.symbol },
          update: {
            name: quote.name,
            price: quote.price,
            change: quote.change,
            changePercent: quote.changePercent,
            volume: vol,
            marketCap: quote.marketCap,
            dayHigh: quote.dayHigh,
            dayLow: quote.dayLow,
            previousClose: quote.previousClose,
          },
          create: {
            symbol: quote.symbol,
            name: quote.name,
            price: quote.price,
            change: quote.change,
            changePercent: quote.changePercent,
            volume: vol,
            marketCap: quote.marketCap,
            dayHigh: quote.dayHigh,
            dayLow: quote.dayLow,
            previousClose: quote.previousClose,
          },
        });
      })
    );

    broadcastQuotes(quotes);
    console.log(`[StockTracker] Refreshed ${quotes.length} quotes`);

    // Evaluate price/volume alerts after quote refresh (fire-and-forget)
    evaluateAlerts(quotes.map(q => ({
      symbol: q.symbol,
      price: q.price,
      change: q.change ?? 0,
      changePercent: q.changePercent ?? 0,
      volume: typeof q.volume === 'number' ? q.volume : 0,
      avgVolume: typeof (q as any).avgVolume === 'number' ? (q as any).avgVolume : 0,
    }))).catch(e => console.error('[StockTracker] Alert evaluation error:', e));
  } catch (err) {
    console.error('[StockTracker] Error refreshing quotes:', err);
  } finally {
    isRefreshing = false;
  }
}

export function startStockTracker() {
  console.log('[StockTracker] Starting stock tracker (60s interval)');
  refreshQuotes(); // immediate first run
  intervalId = setInterval(refreshQuotes, 60_000);
}

export function stopStockTracker() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
