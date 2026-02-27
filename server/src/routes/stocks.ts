import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { getQuote, getQuotes, getHistory } from '../services/stocks/yahoo-finance.js';

const INDICES = [
  '^GSPC',   // S&P 500
  '^DJI',    // Dow Jones
  '^IXIC',   // NASDAQ
  '^RUT',    // Russell 2000
  '^VIX',    // VIX
  '^FTSE',   // FTSE 100
  '^N225',   // Nikkei 225
  '^HSI',    // Hang Seng
  'GC=F',    // Gold
  'CL=F',    // Crude Oil
  'BTC-USD', // Bitcoin
  'DX-Y.NYB', // US Dollar Index
];

const DISPLAY_NAMES: Record<string, string> = {
  '^GSPC': 'S&P 500', '^DJI': 'DOW', '^IXIC': 'NASDAQ', '^RUT': 'Russell 2K',
  '^VIX': 'VIX', '^FTSE': 'FTSE 100', '^N225': 'Nikkei', '^HSI': 'Hang Seng',
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
    res.json(indicesCache.length > 0 ? indicesCache : []);
  }
});

// GET /api/stocks/quotes - all tracked stock quotes
router.get('/quotes', async (req, res) => {
  try {
    const quotes = await prisma.stockQuote.findMany({
      orderBy: { symbol: 'asc' },
    });
    res.json(quotes);
  } catch (err: any) {
    console.error('[Stocks] Error fetching quotes:', err?.message || err);
    res.status(500).json({ error: 'Failed to fetch quotes' });
  }
});

// GET /api/stocks/names - batch ticker→name lookup
router.get('/names', async (req, res) => {
  try {
    const raw = (req.query.symbols as string) || '';
    const symbols = raw.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    if (symbols.length === 0) return res.json({});

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

    // 3. Fetch from Yahoo Finance and cache
    const yahooQuotes = await getQuotes(stillMissing);
    for (const yq of yahooQuotes) {
      if (yq.name) result[yq.symbol] = yq.name;
      // Cache in TrackedStock
      await prisma.trackedStock.upsert({
        where: { symbol: yq.symbol },
        create: { symbol: yq.symbol, name: yq.name || null, source: 'name-lookup' },
        update: { name: yq.name || undefined },
      }).catch(() => {}); // ignore cache failures
    }

    res.json(result);
  } catch (err) {
    console.error('[Stocks] Error fetching names:', err);
    res.status(500).json({ error: 'Failed to fetch stock names' });
  }
});

// GET /api/stocks/:symbol - detail + history
router.get('/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();

    const [quote, history, recommendations] = await Promise.all([
      prisma.stockQuote.findUnique({ where: { symbol } }),
      getHistory(symbol),
      prisma.stockRecommendation.findMany({
        where: { symbol },
        include: { article: { select: { id: true, title: true, scrapedAt: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    res.json({
      quote,
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
  } catch (err) {
    console.error('[Stocks] Error fetching stock detail:', err);
    res.status(500).json({ error: 'Failed to fetch stock detail' });
  }
});

export default router;
