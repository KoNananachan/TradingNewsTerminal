import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { getQuote, getQuotes, getHistory, getProfile } from '../services/stocks/yahoo-finance.js';

const INDICES = [
  '^GSPC',   // S&P 500
  '^DJI',    // Dow Jones
  '^IXIC',   // NASDAQ
  '^RUT',    // Russell 2000
  '^VIX',    // VIX
  '^FTSE',   // FTSE 100
  '^N225',   // Nikkei 225
  '^HSI',    // Hang Seng
  '^GDAXI',  // DAX (Germany)
  '^FCHI',   // CAC 40 (France)
  '000001.SS', // Shanghai Composite
  '^BSESN',  // Sensex (India)
  '^AXJO',   // ASX 200 (Australia)
  '^KS11',   // KOSPI (South Korea)
  '^GSPTSE', // TSX (Canada)
  'GC=F',    // Gold
  'CL=F',    // Crude Oil
  'BTC-USD', // Bitcoin
  'DX-Y.NYB', // US Dollar Index
];

const DISPLAY_NAMES: Record<string, string> = {
  '^GSPC': 'S&P 500', '^DJI': 'DOW', '^IXIC': 'NASDAQ', '^RUT': 'Russell 2K',
  '^VIX': 'VIX', '^FTSE': 'FTSE 100', '^N225': 'Nikkei', '^HSI': 'Hang Seng',
  '^GDAXI': 'DAX', '^FCHI': 'CAC 40', '000001.SS': 'Shanghai', '^BSESN': 'Sensex',
  '^AXJO': 'ASX 200', '^KS11': 'KOSPI', '^GSPTSE': 'TSX',
  'GC=F': 'Gold', 'CL=F': 'Crude Oil', 'BTC-USD': 'BTC', 'DX-Y.NYB': 'DXY',
};

let indicesCache: any[] = [];
let indicesCacheTime = 0;
const INDICES_TTL = 60_000; // 60s cache

const router = Router();

// GET /api/stocks/indices - major market indices for top ticker bar
router.get('/indices', async (_req, res) => {
  try {
    if (Date.now() - indicesCacheTime < INDICES_TTL && indicesCache.length > 0) {
      return res.json(indicesCache);
    }
    const quotes = await getQuotes(INDICES);
    indicesCache = quotes.map((q) => ({
      symbol: DISPLAY_NAMES[q.symbol] || q.symbol,
      price: q.price,
      change: q.change,
      changePercent: q.changePercent,
    }));
    indicesCacheTime = Date.now();
    res.json(indicesCache);
  } catch (err) {
    console.error('[Stocks] Error fetching indices:', err);
    if (indicesCache.length > 0) return res.json(indicesCache);
    res.status(503).json({ error: 'Market indices temporarily unavailable' });
  }
});

// GET /api/stocks/quotes - all tracked stock quotes
router.get('/quotes', async (req, res) => {
  try {
    const quotes = await prisma.stockQuote.findMany({
      orderBy: { symbol: 'asc' },
      take: 500,
    });
    res.json(quotes);
  } catch (err: any) {
    console.error('[Stocks] Error fetching quotes:', err?.message || err);
    const msg = err?.message?.includes('timeout') || err?.name === 'AbortError'
      ? 'Market data temporarily unavailable, please retry'
      : 'Failed to fetch quotes';
    res.status(err?.name === 'AbortError' ? 503 : 500).json({ error: msg });
  }
});

// GET /api/stocks/names - batch ticker→name lookup
router.get('/names', async (req, res) => {
  try {
    const raw = (req.query.symbols as string) || '';
    const symbols = raw.split(',').map(s => s.trim().toUpperCase()).filter(Boolean).filter(s => /^[A-Z0-9.\-^=]{1,20}$/.test(s));
    if (symbols.length === 0) return res.json({});
    if (symbols.length > 100) return res.status(400).json({ error: 'Maximum 100 symbols allowed' });

    const result: Record<string, string> = {};
    const missing: string[] = [];

    // 1. Check StockQuote table
    const quotes = await prisma.stockQuote.findMany({
      where: { symbol: { in: symbols } },
      select: { symbol: true, name: true },
    });
    for (const q of quotes) {
      if (q.name) result[q.symbol] = q.name;
      else missing.push(q.symbol);
    }

    const foundSymbols = new Set(quotes.map(q => q.symbol));
    for (const s of symbols) {
      if (!foundSymbols.has(s)) missing.push(s);
    }

    if (missing.length === 0) return res.json(result);

    // 2. Check TrackedStock table
    const tracked = await prisma.trackedStock.findMany({
      where: { symbol: { in: missing } },
      select: { symbol: true, name: true },
    });
    const stillMissing: string[] = [];
    const trackedSymbols = new Set<string>();
    for (const t of tracked) {
      trackedSymbols.add(t.symbol);
      if (t.name) result[t.symbol] = t.name;
      else stillMissing.push(t.symbol);
    }
    for (const s of missing) {
      if (!trackedSymbols.has(s)) stillMissing.push(s);
    }

    if (stillMissing.length === 0) return res.json(result);

    // 3. Fetch from Yahoo Finance and batch cache
    const yahooQuotes = await getQuotes(stillMissing);
    for (const yq of yahooQuotes) {
      if (yq.name) result[yq.symbol] = yq.name;
    }
    // Batch upsert in a single transaction instead of sequential awaits
    if (yahooQuotes.length > 0) {
      await prisma.$transaction(
        yahooQuotes.map(yq =>
          prisma.trackedStock.upsert({
            where: { symbol: yq.symbol },
            create: { symbol: yq.symbol, name: yq.name || null, source: 'name-lookup' },
            update: { name: yq.name || undefined },
          })
        )
      ).catch((err: any) => {
        if (err?.code !== 'P2002') console.error('[Stocks] Batch cache upsert failed:', err?.message);
      });
    }

    res.json(result);
  } catch (err: any) {
    console.error('[Stocks] Error fetching names:', err?.message || err);
    const msg = err?.message?.includes('timeout') || err?.name === 'AbortError'
      ? 'Market data temporarily unavailable, please retry'
      : 'Failed to fetch stock names';
    res.status(err?.name === 'AbortError' ? 503 : 500).json({ error: msg });
  }
});

// GET /api/stocks/earnings-calendar - upcoming earnings for tracked stocks
router.get('/earnings-calendar', async (req, res) => {
  try {
    const days = Math.min(365, Math.max(1, parseInt(req.query.days as string) || 14));
    const tracked = await prisma.trackedStock.findMany();
    if (tracked.length === 0) return res.json([]);

    const symbols = tracked.map(t => t.symbol);
    const quotes = await getQuotes(symbols);

    const now = new Date();
    const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const results: Array<{
      symbol: string;
      name: string | null;
      earningsDate: string | null;
      epsEstimate: number | null;
      epsActual: number | null;
      revenueEstimate: number | null;
    }> = [];

    for (const quote of quotes) {
      const ext = quote as Record<string, unknown>;
      const earningsDateStr = ext.earningsDate as string | undefined;
      if (!earningsDateStr) continue;

      const earningsDate = new Date(earningsDateStr);
      if (earningsDate >= now && earningsDate <= cutoff) {
        results.push({
          symbol: quote.symbol,
          name: quote.name ?? null,
          earningsDate: earningsDateStr,
          epsEstimate: (ext.epsForward as number) ?? null,
          epsActual: (ext.eps as number) ?? null,
          revenueEstimate: null,
        });
      }
    }

    results.sort((a, b) => {
      const da = a.earningsDate ? new Date(a.earningsDate).getTime() : 0;
      const db = b.earningsDate ? new Date(b.earningsDate).getTime() : 0;
      return da - db;
    });

    res.json(results);
  } catch (err: any) {
    console.error('[Stocks] Error fetching earnings calendar:', err?.message || err);
    res.status(503).json({ error: 'Earnings data temporarily unavailable' });
  }
});

// GET /api/stocks/:symbol - detail + history
router.get('/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();

    const range = (req.query.range as string) || undefined;
    const interval = (req.query.interval as string) || undefined;

    const [dbQuote, liveQuote, history, recommendations, profile] = await Promise.all([
      prisma.stockQuote.findUnique({ where: { symbol } }),
      getQuote(symbol).catch(() => null),
      getHistory(symbol, { range, interval }),
      prisma.stockRecommendation.findMany({
        where: { symbol },
        include: { article: { select: { id: true, title: true, titleTranslations: true, scrapedAt: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      getProfile(symbol).catch(() => null),
    ]);

    // Merge all extended fields from live quote
    const ext = liveQuote as Record<string, unknown> | null;
    const extended = {
      pe: (ext?.pe as number) ?? null,
      forwardPE: (ext?.forwardPE as number) ?? null,
      eps: (ext?.eps as number) ?? null,
      epsForward: (ext?.epsForward as number) ?? null,
      fiftyTwoWeekHigh: (ext?.fiftyTwoWeekHigh as number) ?? null,
      fiftyTwoWeekLow: (ext?.fiftyTwoWeekLow as number) ?? null,
      avgVolume: (ext?.avgVolume as number) ?? null,
      dividendYield: (ext?.dividendYield as number) ?? null,
      dividendRate: (ext?.dividendRate as number) ?? null,
      beta: (ext?.beta as number) ?? null,
      open: (ext?.open as number) ?? null,
      sharesOutstanding: (ext?.sharesOutstanding as number) ?? null,
      floatShares: (ext?.floatShares as number) ?? null,
      bookValue: (ext?.bookValue as number) ?? null,
      priceToBook: (ext?.priceToBook as number) ?? null,
      shortRatio: (ext?.shortRatio as number) ?? null,
      earningsDate: (ext?.earningsDate as string) ?? null,
      fiftyDayAvg: (ext?.fiftyDayAvg as number) ?? null,
      twoHundredDayAvg: (ext?.twoHundredDayAvg as number) ?? null,
      fiftyDayAvgChg: (ext?.fiftyDayAvgChg as number) ?? null,
      twoHundredDayAvgChg: (ext?.twoHundredDayAvgChg as number) ?? null,
    };

    const quote = dbQuote
      ? { ...dbQuote, ...extended }
      : liveQuote
        ? { ...liveQuote, ...extended }
        : null;

    res.json({
      quote,
      profile,
      history: history.map((h) => ({
        time: h.date,
        open: h.open,
        high: h.high,
        low: h.low,
        close: h.close,
        volume: h.volume,
      })),
      recommendations,
    });
  } catch (err: any) {
    console.error('[Stocks] Error fetching stock detail:', err?.message || err);
    const msg = err?.message?.includes('timeout') || err?.name === 'AbortError'
      ? 'Market data temporarily unavailable, please retry'
      : 'Failed to fetch stock detail';
    res.status(err?.name === 'AbortError' ? 503 : 500).json({ error: msg });
  }
});

export default router;
