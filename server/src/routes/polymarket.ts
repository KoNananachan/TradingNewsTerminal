import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const GAMMA_API = 'https://gamma-api.polymarket.com';
const CLOB_API = 'https://clob.polymarket.com';

// Simple in-memory cache for market listings (reduce Gamma API calls)
const marketsCache = new Map<string, { data: any; expiresAt: number }>();
const MARKETS_CACHE_TTL = 30_000; // 30 seconds
const MARKETS_CACHE_MAX = 50;

// Headers that should be forwarded to the CLOB API for authenticated requests
const POLY_HEADERS = [
  'POLY_ADDRESS',
  'POLY_SIGNATURE',
  'POLY_TIMESTAMP',
  'POLY_NONCE',
  'POLY_API_KEY',
  'POLY_PASSPHRASE',
  'POLY_SECRET',
] as const;

/**
 * Extract Polymarket auth headers from the incoming request.
 * Header names are case-insensitive in HTTP, but the CLOB API expects
 * the exact casing above, so we normalise on the way through.
 */
function extractPolyHeaders(req: Request): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const name of POLY_HEADERS) {
    // Express lowercases all incoming header names
    const value = req.headers[name.toLowerCase()];
    if (typeof value === 'string') {
      headers[name] = value;
    }
  }
  return headers;
}

// ---------------------------------------------------------------------------
// Gamma API endpoints
// ---------------------------------------------------------------------------

// GET /markets - list markets
// When a tag is specified, uses events API (tag_slug) and flattens markets,
// because the Gamma /markets endpoint does not support tag filtering.
router.get('/markets', async (req: Request, res: Response) => {
  try {
    const tag = req.query.tag ? String(req.query.tag).slice(0, 100) : '';
    const hasTag = tag && /^[a-zA-Z0-9_ -]+$/.test(tag);
    const limit = parseInt(String(req.query.limit ?? '20'));
    const safeLimit = Math.min(Math.max(limit, 1), 200);

    const offset = req.query.offset ? parseInt(String(req.query.offset)) : 0;
    const safeOffset = !isNaN(offset) && offset >= 0 ? offset : 0;
    const cacheKey = `markets:${tag || 'all'}:${safeLimit}:${safeOffset}`;
    const cached = marketsCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return res.json(cached.data);
    }

    let markets: any[];

    if (hasTag) {
      // Use events API with tag_slug — the only way to filter by category
      const params = new URLSearchParams();
      params.set('closed', 'false');
      params.set('active', 'true');
      params.set('limit', '20');
      params.set('order', 'volume24hr');
      params.set('ascending', 'false');
      params.set('tag_slug', tag);

      const response = await fetch(`${GAMMA_API}/events?${params}`);
      if (!response.ok) {
        console.error('[Polymarket] events upstream error:', response.status);
        return res.status(502).json({ error: 'Polymarket API error' });
      }
      const events = await response.json();
      // Flatten: extract markets from each event
      markets = [];
      if (Array.isArray(events)) {
        for (const event of events) {
          if (Array.isArray(event.markets)) {
            for (const m of event.markets) {
              if (!m.closed && m.active) {
                // Attach event info for link generation
                if (!m.events) m.events = [{ slug: event.slug }];
                markets.push(m);
              }
            }
          }
        }
      }
      // Sort by 24h volume descending and limit
      markets.sort((a: any, b: any) => {
        const volA = parseFloat(a.volume24hr || a.volumeNum || '0');
        const volB = parseFloat(b.volume24hr || b.volumeNum || '0');
        return volB - volA;
      });
      markets = markets.slice(0, safeLimit);
    } else {
      // No tag — use markets API directly
      const params = new URLSearchParams();
      params.set('closed', 'false');
      params.set('limit', String(safeLimit));
      params.set('order', 'volume24hr');
      params.set('ascending', 'false');
      params.set('active', 'true');
      if (safeOffset > 0) params.set('offset', String(safeOffset));

      const response = await fetch(`${GAMMA_API}/markets?${params}`);
      if (!response.ok) {
        console.error('[Polymarket] markets upstream error:', response.status);
        return res.status(502).json({ error: 'Polymarket API error' });
      }
      const data = await response.json();
      markets = Array.isArray(data)
        ? data.filter((m: any) => !m.closed && m.active)
        : [];
    }

    // Cache management
    if (marketsCache.size >= MARKETS_CACHE_MAX) {
      const now = Date.now();
      for (const [k, v] of marketsCache) {
        if (now > v.expiresAt) marketsCache.delete(k);
      }
      if (marketsCache.size >= MARKETS_CACHE_MAX) {
        const first = marketsCache.keys().next().value;
        if (first) marketsCache.delete(first);
      }
    }
    marketsCache.set(cacheKey, { data: markets, expiresAt: Date.now() + MARKETS_CACHE_TTL });
    res.json(markets);
  } catch (err) {
    console.error('[Polymarket] markets error:', err);
    res.status(502).json({ error: 'Failed to fetch Polymarket markets' });
  }
});

// GET /markets/:id - single market detail
router.get('/markets/:id', async (req: Request, res: Response) => {
  try {
    const marketId = String(req.params.id);
    if (!/^[a-zA-Z0-9_\-]{1,200}$/.test(marketId)) {
      return res.status(400).json({ error: 'Invalid market ID' });
    }
    const response = await fetch(`${GAMMA_API}/markets/${marketId}`);
    if (!response.ok) {
      return res.status(response.status === 404 ? 404 : 502).json({ error: 'Market not found' });
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('[Polymarket] market detail error:', err);
    res.status(502).json({ error: 'Failed to fetch market detail' });
  }
});

// GET /events - events listing
router.get('/events', async (req: Request, res: Response) => {
  try {
    const params = new URLSearchParams();
    params.set('closed', String(req.query.closed ?? 'false'));
    params.set('limit', String(req.query.limit ?? '20'));
    params.set('order', String(req.query.order ?? 'volume24hr'));
    params.set('ascending', String(req.query.ascending ?? 'false'));
    params.set('active', 'true');
    if (req.query.offset) {
      const offset = parseInt(String(req.query.offset));
      if (!isNaN(offset) && offset >= 0) params.set('offset', String(offset));
    }
    if (req.query.tag) {
      const tag = String(req.query.tag).slice(0, 100);
      if (/^[a-zA-Z0-9_ -]+$/.test(tag)) params.set('tag', tag);
    }

    const response = await fetch(`${GAMMA_API}/events?${params}`);
    if (!response.ok) {
      console.error('[Polymarket] events upstream error:', response.status);
      return res.status(502).json({ error: 'Polymarket API error' });
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('[Polymarket] events error:', err);
    res.status(502).json({ error: 'Failed to fetch Polymarket events' });
  }
});

// ---------------------------------------------------------------------------
// CLOB API endpoints
// ---------------------------------------------------------------------------

// GET /clob/book?token_id=X - Order book for a token
router.get('/clob/book', async (req: Request, res: Response) => {
  try {
    const tokenId = String(req.query.token_id || '');
    if (!tokenId || !/^[a-zA-Z0-9_\-]{1,200}$/.test(tokenId)) {
      return res.status(400).json({ error: 'Valid token_id query parameter is required' });
    }

    const params = new URLSearchParams({ token_id: tokenId });
    const response = await fetch(`${CLOB_API}/book?${params}`);
    if (!response.ok) {
      const body = await response.text();
      console.error('[Polymarket] CLOB book error:', response.status, body);
      return res.status(502).json({ error: 'CLOB API error' });
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('[Polymarket] CLOB book error:', err);
    res.status(502).json({ error: 'Failed to fetch order book' });
  }
});

// GET /clob/midpoint?token_id=X - Current midpoint price
router.get('/clob/midpoint', async (req: Request, res: Response) => {
  try {
    const tokenId = String(req.query.token_id || '');
    if (!tokenId || !/^[a-zA-Z0-9_\-]{1,200}$/.test(tokenId)) {
      return res.status(400).json({ error: 'Valid token_id query parameter is required' });
    }

    const params = new URLSearchParams({ token_id: tokenId });
    const response = await fetch(`${CLOB_API}/midpoint?${params}`);
    if (!response.ok) {
      const body = await response.text();
      console.error('[Polymarket] CLOB midpoint error:', response.status, body);
      return res.status(502).json({ error: 'CLOB API error' });
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('[Polymarket] CLOB midpoint error:', err);
    res.status(502).json({ error: 'Failed to fetch midpoint price' });
  }
});

// GET /clob/price?token_id=X&side=buy|sell - Best price for a side
router.get('/clob/price', async (req: Request, res: Response) => {
  try {
    const tokenId = String(req.query.token_id || '');
    const side = req.query.side;
    if (!tokenId || !/^[a-zA-Z0-9_\-]{1,200}$/.test(tokenId)) {
      return res.status(400).json({ error: 'Valid token_id query parameter is required' });
    }
    if (!side || (side !== 'buy' && side !== 'sell')) {
      return res.status(400).json({ error: 'side query parameter is required and must be "buy" or "sell"' });
    }

    const params = new URLSearchParams({ token_id: tokenId, side: String(side) });
    const response = await fetch(`${CLOB_API}/price?${params}`);
    if (!response.ok) {
      const body = await response.text();
      console.error('[Polymarket] CLOB price error:', response.status, body);
      return res.status(502).json({ error: 'CLOB API error' });
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('[Polymarket] CLOB price error:', err);
    res.status(502).json({ error: 'Failed to fetch price' });
  }
});

// GET /clob/prices-history?market=CONDITION_ID&interval=1d|1w|1m|all&fidelity=1-60 - Price history
router.get('/clob/prices-history', async (req: Request, res: Response) => {
  try {
    const market = String(req.query.market || '');
    if (!market || !/^0x[a-fA-F0-9]{1,128}$/.test(market)) {
      return res.status(400).json({ error: 'Valid market query parameter is required' });
    }

    const params = new URLSearchParams({ market });
    const interval = String(req.query.interval || '');
    if (interval && /^(1d|1w|1m|max|all)$/.test(interval)) params.set('interval', interval);
    const fidelity = parseInt(String(req.query.fidelity || ''));
    if (!isNaN(fidelity) && fidelity >= 1 && fidelity <= 60) params.set('fidelity', String(fidelity));

    const response = await fetch(`${CLOB_API}/prices-history?${params}`);
    if (!response.ok) {
      const body = await response.text();
      console.error('[Polymarket] CLOB prices-history error:', response.status, body);
      return res.status(502).json({ error: 'CLOB API error' });
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('[Polymarket] CLOB prices-history error:', err);
    res.status(502).json({ error: 'Failed to fetch price history' });
  }
});

// POST /clob/auth/derive-api-key - Proxy API key derivation (pass through body and headers)
router.post('/clob/auth/derive-api-key', requireAuth, async (req: Request, res: Response) => {
  try {
    const polyHeaders = extractPolyHeaders(req);

    const response = await fetch(`${CLOB_API}/auth/derive-api-key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...polyHeaders,
      },
      body: JSON.stringify(req.body),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('[Polymarket] CLOB derive-api-key error:', response.status, body);
      return res.status(502).json({ error: 'CLOB API error' });
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('[Polymarket] CLOB derive-api-key error:', err);
    res.status(502).json({ error: 'Failed to derive API key' });
  }
});

// POST /clob/order - Proxy order placement (pass through body and headers)
router.post('/clob/order', requireAuth, async (req: Request, res: Response) => {
  try {
    const polyHeaders = extractPolyHeaders(req);

    const response = await fetch(`${CLOB_API}/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...polyHeaders,
      },
      body: JSON.stringify(req.body),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('[Polymarket] CLOB order placement error:', response.status, body);
      return res.status(502).json({ error: 'CLOB API error' });
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('[Polymarket] CLOB order placement error:', err);
    res.status(502).json({ error: 'Failed to place order' });
  }
});

// DELETE /clob/order/:id - Cancel order (pass through headers)
router.delete('/clob/order/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const orderId = String(req.params.id);
    if (!/^[a-zA-Z0-9_\-]{1,200}$/.test(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }
    const polyHeaders = extractPolyHeaders(req);

    const response = await fetch(`${CLOB_API}/order/${orderId}`, {
      method: 'DELETE',
      headers: {
        ...polyHeaders,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('[Polymarket] CLOB order cancel error:', response.status, body);
      return res.status(502).json({ error: 'CLOB API error' });
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('[Polymarket] CLOB order cancel error:', err);
    res.status(502).json({ error: 'Failed to cancel order' });
  }
});

// GET /clob/data/position?user=ADDRESS&market=CONDITION_ID - Get user position
router.get('/clob/data/position', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = String(req.query.user || '');
    const market = String(req.query.market || '');
    if (!user || !/^0x[a-fA-F0-9]{40}$/.test(user)) {
      return res.status(400).json({ error: 'Valid user address is required' });
    }
    if (!market || !/^0x[a-fA-F0-9]{1,128}$/.test(market)) {
      return res.status(400).json({ error: 'Valid market query parameter is required' });
    }

    const params = new URLSearchParams({ user, market });
    const response = await fetch(`${CLOB_API}/data/position?${params}`);
    if (!response.ok) {
      const body = await response.text();
      console.error('[Polymarket] CLOB position error:', response.status, body);
      return res.status(502).json({ error: 'CLOB API error' });
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('[Polymarket] CLOB position error:', err);
    res.status(502).json({ error: 'Failed to fetch position' });
  }
});

export default router;
