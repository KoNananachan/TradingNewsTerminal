import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const YAHOO_SEARCH = 'https://query1.finance.yahoo.com/v1/finance/search';

const router = Router();

// GET /api/watchlist - user's watchlist (default + user-added)
router.get('/', async (req, res) => {
  try {
    const tracked = await prisma.trackedStock.findMany({
      where: { source: { in: ['default', 'watchlist'] } },
      orderBy: { addedAt: 'asc' },
      take: 500,
    });

    const symbols = tracked.map((t) => t.symbol);
    const quotes = await prisma.stockQuote.findMany({
      where: { symbol: { in: symbols } },
    });

    const quoteMap = new Map(quotes.map((q) => [q.symbol, q]));

    const result = tracked.map((t) => ({
      symbol: t.symbol,
      name: t.name,
      source: t.source,
      quote: quoteMap.get(t.symbol) || null,
    }));

    res.json(result);
  } catch (err) {
    console.error('[Watchlist] Error:', err);
    res.status(500).json({ error: 'Failed to fetch watchlist' });
  }
});

// POST /api/watchlist - add ticker (requires auth)
router.post('/', requireAuth, async (req, res) => {
  try {
    const { symbol } = req.body;
    if (!symbol || typeof symbol !== 'string') {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    const sym = symbol.toUpperCase().trim();
    if (!/^[A-Z0-9.\-]{1,10}$/.test(sym)) {
      return res.status(400).json({ error: 'Invalid symbol format' });
    }

    const existing = await prisma.trackedStock.findUnique({ where: { symbol: sym } });
    if (existing) {
      // If it was ai-recommended, promote to watchlist
      if (existing.source === 'ai-recommended') {
        await prisma.trackedStock.update({
          where: { symbol: sym },
          data: { source: 'watchlist' },
        });
      }
      return res.json({ symbol: sym, added: true });
    }

    await prisma.trackedStock.create({
      data: { symbol: sym, name: sym, source: 'watchlist' },
    });

    res.json({ symbol: sym, added: true });
  } catch (err) {
    console.error('[Watchlist] Error adding:', err);
    res.status(500).json({ error: 'Failed to add symbol' });
  }
});

// GET /api/watchlist/search?q=... - search Yahoo Finance for ticker suggestions
// NOTE: Must be defined BEFORE /:symbol to prevent Express from matching "search" as a symbol
router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q as string || '').trim();
    if (q.length < 1 || q.length > 100) return res.json([]);

    const url = `${YAHOO_SEARCH}?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0&listsCount=0`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(10_000),
    });

    if (!resp.ok) return res.json([]);
    const data = (await resp.json()) as any;
    const quotes = (data?.quotes || [])
      .filter((q: any) => q.symbol && (q.quoteType === 'EQUITY' || q.quoteType === 'ETF' || q.quoteType === 'CRYPTOCURRENCY' || q.quoteType === 'INDEX'))
      .map((q: any) => ({
        symbol: q.symbol,
        name: q.shortname || q.longname || q.symbol,
        type: q.quoteType,
        exchange: q.exchDisp || q.exchange || '',
      }));

    res.json(quotes);
  } catch (err: any) {
    console.error('[Watchlist] Search error:', err?.message || err);
    const isTimeout = err?.name === 'AbortError' || err?.name === 'TimeoutError';
    res.status(isTimeout ? 503 : 500).json({ error: 'Search temporarily unavailable' });
  }
});

// DELETE /api/watchlist/:symbol - remove ticker (requires auth)
router.delete('/:symbol', requireAuth, async (req, res) => {
  try {
    const sym = String(req.params.symbol).toUpperCase().trim();
    if (!/^[A-Z0-9.\-]{1,10}$/.test(sym)) return res.status(400).json({ error: 'Invalid symbol format' });

    await prisma.trackedStock.deleteMany({ where: { symbol: sym } });
    await prisma.stockQuote.deleteMany({ where: { symbol: sym } });

    res.json({ symbol: sym, removed: true });
  } catch (err) {
    console.error('[Watchlist] Error removing:', err);
    res.status(500).json({ error: 'Failed to remove symbol' });
  }
});

export default router;
