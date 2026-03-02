import { prisma } from '../../lib/prisma.js';
import { getInsiderTransactions } from './yahoo-finance.js';

const POLL_INTERVAL = 30 * 60_000; // 30 minutes
let intervalId: ReturnType<typeof setInterval> | null = null;

async function pollInsiderTrades() {
  try {
    const trackedStocks = await prisma.trackedStock.findMany({
      select: { symbol: true },
      take: 20,
    });

    if (trackedStocks.length === 0) return;

    console.log(`[InsiderTracker] Checking insider trades for ${trackedStocks.length} symbols`);

    for (const stock of trackedStocks) {
      const txns = await getInsiderTransactions(stock.symbol);

      for (const t of txns) {
        const tradeDate = new Date(t.transactionDate);
        const filingDate = t.filingDate ? new Date(t.filingDate) : tradeDate;

        // Skip trades older than 90 days
        if (Date.now() - tradeDate.getTime() > 90 * 24 * 60 * 60_000) continue;

        // Dedup by symbol + owner + date + shares + type
        const existing = await prisma.insiderTrade.findFirst({
          where: {
            symbol: stock.symbol,
            ownerName: t.ownerName,
            tradeDate,
            shares: t.shares,
            transactionType: t.transactionType,
          },
        });
        if (existing) continue;

        const pricePerShare = t.value && t.shares ? Math.round((t.value / t.shares) * 100) / 100 : null;

        await prisma.insiderTrade.create({
          data: {
            symbol: stock.symbol,
            filingDate,
            tradeDate,
            ownerName: t.ownerName,
            ownerTitle: t.ownerTitle,
            transactionType: t.transactionType,
            shares: t.shares,
            pricePerShare,
            totalValue: t.value,
            secFilingUrl: null,
          },
        });
      }

      // Small delay between symbols to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('[InsiderTracker] Insider trade poll complete');
  } catch (err) {
    console.error('[InsiderTracker] Error polling insider trades:', err instanceof Error ? err.message : err);
  }
}

export function startInsiderTracker() {
  console.log('[InsiderTracker] Starting insider tracker (30min interval)');
  pollInsiderTrades();
  intervalId = setInterval(pollInsiderTrades, POLL_INTERVAL);
}

export function stopInsiderTracker() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
