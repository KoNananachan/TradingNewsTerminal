import { prisma } from '../../lib/prisma.js';

const POLL_INTERVAL = 30 * 60_000; // 30 minutes
const SEC_UA = 'TradingNewsWeb/1.0 (contact@tradingnews.app)';
let intervalId: ReturnType<typeof setInterval> | null = null;

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface SecFiling {
  accessionNo: string;
  filedAt: string;
  formType: string;
  description: string;
  primaryDocument: string;
  fileUrl: string;
}

interface ParsedInsiderTrade {
  symbol: string;
  filingDate: Date;
  tradeDate: Date;
  ownerName: string;
  ownerTitle: string | null;
  transactionType: string; // P or S
  shares: number;
  pricePerShare: number | null;
  totalValue: number | null;
  secFilingUrl: string | null;
}

async function fetchCIK(symbol: string): Promise<string | null> {
  try {
    const url = `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(symbol)}%22&forms=4&dateRange=custom&startdt=${toDateString(new Date(Date.now() - 30 * 24 * 60 * 60_000))}&enddt=${toDateString(new Date())}`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': SEC_UA, Accept: 'application/json' },
    });
    if (!resp.ok) return null;
    const data = await resp.json() as any;
    // Extract CIK from first result if available
    const hits = data?.hits?.hits;
    if (Array.isArray(hits) && hits.length > 0) {
      const cik = hits[0]?._source?.entity_id || hits[0]?._source?.ciks?.[0];
      return cik ? String(cik) : null;
    }
    return null;
  } catch (err) {
    console.error(`[InsiderTracker] Error fetching CIK for ${symbol}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

async function fetchRecentFilings(symbol: string): Promise<ParsedInsiderTrade[]> {
  const trades: ParsedInsiderTrade[] = [];

  try {
    const today = new Date();
    const startDate = toDateString(new Date(today.getTime() - 30 * 24 * 60 * 60_000));
    const endDate = toDateString(today);

    // Use the SEC full-text search for Form 4 filings related to this ticker
    const url = `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(symbol)}%22&forms=4&dateRange=custom&startdt=${startDate}&enddt=${endDate}`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': SEC_UA, Accept: 'application/json' },
    });

    if (!resp.ok) {
      console.error(`[InsiderTracker] SEC API error for ${symbol}: ${resp.status}`);
      return trades;
    }

    const data = await resp.json() as any;
    const hits = data?.hits?.hits;

    if (!Array.isArray(hits)) return trades;

    for (const hit of hits.slice(0, 10)) { // Process max 10 filings per symbol
      const source = hit._source;
      if (!source) continue;

      const filingDate = source.file_date ? new Date(source.file_date) : new Date();
      const ownerName = source.display_names?.[0] || 'Unknown';

      // Parse basic info from the filing metadata
      // Note: Full XML parsing of Form 4 is complex; we extract what we can from metadata
      trades.push({
        symbol: symbol.toUpperCase(),
        filingDate,
        tradeDate: filingDate, // Best approximation from metadata
        ownerName,
        ownerTitle: null,
        transactionType: 'P', // Default; would need XML parsing for accuracy
        shares: 0,
        pricePerShare: null,
        totalValue: null,
        secFilingUrl: source.file_url || null,
      });
    }
  } catch (err) {
    console.error(`[InsiderTracker] Error fetching filings for ${symbol}:`, err instanceof Error ? err.message : err);
  }

  return trades;
}

async function pollInsiderTrades() {
  try {
    // Get tracked symbols from the database
    const trackedStocks = await prisma.trackedStock.findMany({
      select: { symbol: true },
      take: 20, // Limit to avoid rate limiting
    });

    if (trackedStocks.length === 0) return;

    console.log(`[InsiderTracker] Checking insider trades for ${trackedStocks.length} symbols`);

    for (const stock of trackedStocks) {
      const trades = await fetchRecentFilings(stock.symbol);

      for (const trade of trades) {
        // Generate a unique key for deduplication
        const uniqueKey = `${trade.symbol}-${trade.ownerName}-${toDateString(trade.filingDate)}`;

        // Check if this trade already exists
        const existing = await prisma.insiderTrade.findFirst({
          where: {
            symbol: trade.symbol,
            ownerName: trade.ownerName,
            filingDate: trade.filingDate,
          },
        });

        if (existing) continue;

        await prisma.insiderTrade.create({
          data: {
            symbol: trade.symbol,
            filingDate: trade.filingDate,
            tradeDate: trade.tradeDate,
            ownerName: trade.ownerName,
            ownerTitle: trade.ownerTitle,
            transactionType: trade.transactionType,
            shares: trade.shares,
            pricePerShare: trade.pricePerShare,
            totalValue: trade.totalValue,
            secFilingUrl: trade.secFilingUrl,
          },
        });
      }

      // Small delay between symbols to respect SEC rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('[InsiderTracker] Insider trade poll complete');
  } catch (err) {
    console.error('[InsiderTracker] Error polling insider trades:', err instanceof Error ? err.message : err);
  }
}

export function startInsiderTracker() {
  console.log('[InsiderTracker] Starting insider tracker (30min interval)');
  pollInsiderTrades(); // immediate first run
  intervalId = setInterval(pollInsiderTrades, POLL_INTERVAL);
}

export function stopInsiderTracker() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
