import { Router, Request, Response } from 'express';

const router = Router();

const GAMMA_API = 'https://gamma-api.polymarket.com';
const CLOB_API = 'https://clob.polymarket.com';

// Simple in-memory cache for market listings (reduce Gamma API calls)
const marketsCache = new Map<string, { data: any; expiresAt: number }>();
const MARKETS_CACHE_TTL = 30_000; // 30 seconds

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
router.get('/markets', async (req: Request, res: Response) => {
  try {
    const params = new URLSearchParams();
    params.set('closed', String(req.query.closed ?? 'false'));
    params.set('limit', String(req.query.limit ?? '20'));
    params.set('order', String(req.query.order ?? 'volume24hr'));
    params.set('ascending', String(req.query.ascending ?? 'false'));
    params.set('active', 'true');
    if (req.query.offset) params.set('offset', String(req.query.offset));
    if (req.query.tag) params.set('tag', String(req.query.tag));

    const cacheKey = params.toString();
    const cached = marketsCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return res.json(cached.data);
    }

    const response = await fetch(`${GAMMA_API}/markets?${params}`);
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Polymarket API error' });
    }
    const data = await response.json();
    // Filter out resolved markets (any outcome price >= 0.99)
    const filtered = Array.isArray(data)
      ? data.filter((m: any) => {
          if (m.closed || !m.active) return false;
          try {
            const prices: number[] = JSON.parse(m.outcomePrices || '[]');
            return !prices.some((p) => p >= 0.99);
          } catch { return true; }
        })
      : data;
    marketsCache.set(cacheKey, { data: filtered, expiresAt: Date.now() + MARKETS_CACHE_TTL });
    res.json(filtered);
  } catch (err) {
    console.error('[Polymarket] markets error:', err);
    res.status(502).json({ error: 'Failed to fetch Polymarket markets' });
  }
});

// GET /markets/:id - single market detail
router.get('/markets/:id', async (req: Request, res: Response) => {
  try {
    const response = await fetch(`${GAMMA_API}/markets/${req.params.id}`);
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Market not found' });
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
    if (req.query.offset) params.set('offset', String(req.query.offset));
    if (req.query.tag) params.set('tag', String(req.query.tag));

    const response = await fetch(`${GAMMA_API}/events?${params}`);
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Polymarket API error' });
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
    const tokenId = req.query.token_id;
    if (!tokenId) {
      return res.status(400).json({ error: 'token_id query parameter is required' });
    }

    const params = new URLSearchParams({ token_id: String(tokenId) });
    const response = await fetch(`${CLOB_API}/book?${params}`);
    if (!response.ok) {
      const body = await response.text();
      console.error('[Polymarket] CLOB book error:', response.status, body);
      return res.status(response.status).json({ error: 'CLOB API error', detail: body });
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
    const tokenId = req.query.token_id;
    if (!tokenId) {
      return res.status(400).json({ error: 'token_id query parameter is required' });
    }

    const params = new URLSearchParams({ token_id: String(tokenId) });
    const response = await fetch(`${CLOB_API}/midpoint?${params}`);
    if (!response.ok) {
      const body = await response.text();
      console.error('[Polymarket] CLOB midpoint error:', response.status, body);
      return res.status(response.status).json({ error: 'CLOB API error', detail: body });
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
    const tokenId = req.query.token_id;
    const side = req.query.side;
    if (!tokenId) {
      return res.status(400).json({ error: 'token_id query parameter is required' });
    }
    if (!side || (side !== 'buy' && side !== 'sell')) {
      return res.status(400).json({ error: 'side query parameter is required and must be "buy" or "sell"' });
    }

    const params = new URLSearchParams({ token_id: String(tokenId), side: String(side) });
    const response = await fetch(`${CLOB_API}/price?${params}`);
    if (!response.ok) {
      const body = await response.text();
      console.error('[Polymarket] CLOB price error:', response.status, body);
      return res.status(response.status).json({ error: 'CLOB API error', detail: body });
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
    const market = req.query.market;
    if (!market) {
      return res.status(400).json({ error: 'market query parameter is required' });
    }

    const params = new URLSearchParams({ market: String(market) });
    if (req.query.interval) params.set('interval', String(req.query.interval));
    if (req.query.fidelity) params.set('fidelity', String(req.query.fidelity));

    const response = await fetch(`${CLOB_API}/prices-history?${params}`);
    if (!response.ok) {
      const body = await response.text();
      console.error('[Polymarket] CLOB prices-history error:', response.status, body);
      return res.status(response.status).json({ error: 'CLOB API error', detail: body });
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('[Polymarket] CLOB prices-history error:', err);
    res.status(502).json({ error: 'Failed to fetch price history' });
  }
});

// POST /clob/auth/derive-api-key - Proxy API key derivation (pass through body and headers)
router.post('/clob/auth/derive-api-key', async (req: Request, res: Response) => {
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
      return res.status(response.status).json({ error: 'CLOB API error', detail: body });
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('[Polymarket] CLOB derive-api-key error:', err);
    res.status(502).json({ error: 'Failed to derive API key' });
  }
});

// POST /clob/order - Proxy order placement (pass through body and headers)
router.post('/clob/order', async (req: Request, res: Response) => {
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
      return res.status(response.status).json({ error: 'CLOB API error', detail: body });
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('[Polymarket] CLOB order placement error:', err);
    res.status(502).json({ error: 'Failed to place order' });
  }
});

// DELETE /clob/order/:id - Cancel order (pass through headers)
router.delete('/clob/order/:id', async (req: Request, res: Response) => {
  try {
    const polyHeaders = extractPolyHeaders(req);

    const response = await fetch(`${CLOB_API}/order/${req.params.id}`, {
      method: 'DELETE',
      headers: {
        ...polyHeaders,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('[Polymarket] CLOB order cancel error:', response.status, body);
      return res.status(response.status).json({ error: 'CLOB API error', detail: body });
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('[Polymarket] CLOB order cancel error:', err);
    res.status(502).json({ error: 'Failed to cancel order' });
  }
});

// GET /clob/data/position?user=ADDRESS&market=CONDITION_ID - Get user position (no auth needed)
router.get('/clob/data/position', async (req: Request, res: Response) => {
  try {
    const user = req.query.user;
    const market = req.query.market;
    if (!user) {
      return res.status(400).json({ error: 'user query parameter is required' });
    }
    if (!market) {
      return res.status(400).json({ error: 'market query parameter is required' });
    }

    const params = new URLSearchParams({
      user: String(user),
      market: String(market),
    });
    const response = await fetch(`${CLOB_API}/data/position?${params}`);
    if (!response.ok) {
      const body = await response.text();
      console.error('[Polymarket] CLOB position error:', response.status, body);
      return res.status(response.status).json({ error: 'CLOB API error', detail: body });
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('[Polymarket] CLOB position error:', err);
    res.status(502).json({ error: 'Failed to fetch position' });
  }
});

export default router;
