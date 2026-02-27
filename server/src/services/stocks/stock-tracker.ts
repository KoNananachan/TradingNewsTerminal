import { prisma } from '../../lib/prisma.js';
import { getQuotes } from './yahoo-finance.js';
import { broadcastQuotes } from '../websocket/ws-server.js';

let intervalId: ReturnType<typeof setInterval> | null = null;

async function refreshQuotes() {
  try {
    const tracked = await prisma.trackedStock.findMany();
    if (tracked.length === 0) return;

    const symbols = tracked.map((t) => t.symbol);
    const quotes = await getQuotes(symbols);

    for (const quote of quotes) {
      const vol = quote.volume != null ? BigInt(Math.round(quote.volume)) : null;
      await prisma.stockQuote.upsert({
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
    }

    broadcastQuotes(quotes);
    console.log(`[StockTracker] Refreshed ${quotes.length} quotes`);
  } catch (err) {
    console.error('[StockTracker] Error refreshing quotes:', err);
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
