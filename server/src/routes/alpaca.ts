import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { encrypt, decrypt, isEncrypted } from '../lib/crypto.js';

const router = Router();

// All Alpaca routes require authentication
router.use(requireAuth);

function getAlpacaBaseUrl(paper: boolean) {
  return paper
    ? 'https://paper-api.alpaca.markets'
    : 'https://api.alpaca.markets';
}

async function alpacaFetch(
  apiKey: string,
  secretKey: string,
  paper: boolean,
  path: string,
  init?: RequestInit,
) {
  const base = getAlpacaBaseUrl(paper);
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      'APCA-API-KEY-ID': apiKey,
      'APCA-API-SECRET-KEY': secretKey,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Alpaca API ${res.status}: ${body.slice(0, 200)}`);
  }

  return res.json();
}

// POST /api/alpaca/connect — Save Alpaca API keys
router.post('/connect', async (req, res) => {
  try {
    const { apiKey, secretKey, paper = true } = req.body;
    if (!apiKey || !secretKey) {
      return res.status(400).json({ error: 'API key and secret key required' });
    }

    // Verify keys by fetching account
    try {
      await alpacaFetch(apiKey, secretKey, paper, '/v2/account');
    } catch (err: any) {
      console.error('[Alpaca] Credential verification failed:', err?.message);
      return res.status(400).json({ error: 'Alpaca credentials verification failed. Check your API keys.' });
    }

    await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        alpacaApiKey: encrypt(apiKey),
        alpacaSecretKey: encrypt(secretKey),
        alpacaPaper: paper,
      },
    });

    res.json({ ok: true, paper });
  } catch (err: any) {
    console.error('[Alpaca] Connect error:', err?.message);
    res.status(500).json({ error: 'Failed to connect Alpaca' });
  }
});

// POST /api/alpaca/disconnect — Remove Alpaca API keys
router.post('/disconnect', async (req, res) => {
  await prisma.user.update({
    where: { id: req.user!.id },
    data: { alpacaApiKey: null, alpacaSecretKey: null },
  });
  res.json({ ok: true });
});

// GET /api/alpaca/account — Get Alpaca account info
router.get('/account', async (req, res) => {
  const { alpacaApiKey, alpacaSecretKey, alpacaPaper } = req.user!;
  if (!alpacaApiKey || !alpacaSecretKey) {
    return res.status(400).json({ error: 'Alpaca not connected' });
  }

  try {
    const account = await alpacaFetch(alpacaApiKey, alpacaSecretKey, alpacaPaper, '/v2/account');
    res.json(account);
  } catch (err: any) {
    console.error('[Alpaca] Account error:', err?.message);
    res.status(502).json({ error: 'Failed to fetch Alpaca account' });
  }
});

// GET /api/alpaca/positions — Get open positions
router.get('/positions', async (req, res) => {
  const { alpacaApiKey, alpacaSecretKey, alpacaPaper } = req.user!;
  if (!alpacaApiKey || !alpacaSecretKey) {
    return res.status(400).json({ error: 'Alpaca not connected' });
  }

  try {
    const positions = await alpacaFetch(alpacaApiKey, alpacaSecretKey, alpacaPaper, '/v2/positions');
    res.json(positions);
  } catch (err: any) {
    console.error('[Alpaca] Positions error:', err?.message);
    res.status(502).json({ error: 'Failed to fetch positions' });
  }
});

// GET /api/alpaca/orders — Get recent orders
router.get('/orders', async (req, res) => {
  const { alpacaApiKey, alpacaSecretKey, alpacaPaper } = req.user!;
  if (!alpacaApiKey || !alpacaSecretKey) {
    return res.status(400).json({ error: 'Alpaca not connected' });
  }

  try {
    const status = req.query.status || 'all';
    const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
    const orders = await alpacaFetch(
      alpacaApiKey, alpacaSecretKey, alpacaPaper,
      `/v2/orders?status=${status}&limit=${limit}&direction=desc`,
    );
    res.json(orders);
  } catch (err: any) {
    console.error('[Alpaca] Orders error:', err?.message);
    res.status(502).json({ error: 'Failed to fetch orders' });
  }
});

// POST /api/alpaca/orders — Place an order
router.post('/orders', async (req, res) => {
  const { alpacaApiKey, alpacaSecretKey, alpacaPaper } = req.user!;
  if (!alpacaApiKey || !alpacaSecretKey) {
    return res.status(400).json({ error: 'Alpaca not connected' });
  }

  try {
    const { symbol, qty, notional, side, type, time_in_force, limit_price, stop_price } = req.body;

    if (!symbol || !side) {
      return res.status(400).json({ error: 'symbol and side are required' });
    }

    if (!['buy', 'sell'].includes(side)) {
      return res.status(400).json({ error: 'side must be "buy" or "sell"' });
    }

    if (!qty && !notional) {
      return res.status(400).json({ error: 'qty or notional is required' });
    }

    if (qty && (isNaN(Number(qty)) || Number(qty) <= 0)) {
      return res.status(400).json({ error: 'qty must be a positive number' });
    }

    if (notional && (isNaN(Number(notional)) || Number(notional) <= 0)) {
      return res.status(400).json({ error: 'notional must be a positive number' });
    }

    const orderPayload: Record<string, unknown> = {
      symbol: symbol.toUpperCase(),
      side,
      type: type || 'market',
      time_in_force: time_in_force || 'day',
    };

    if (qty) orderPayload.qty = String(qty);
    if (notional) orderPayload.notional = String(notional);
    if (limit_price) orderPayload.limit_price = String(limit_price);
    if (stop_price) orderPayload.stop_price = String(stop_price);

    const order = await alpacaFetch(
      alpacaApiKey, alpacaSecretKey, alpacaPaper,
      '/v2/orders',
      { method: 'POST', body: JSON.stringify(orderPayload) },
    );

    console.log(`[Alpaca] Order placed: ${side} ${qty || notional} ${symbol} (${alpacaPaper ? 'paper' : 'live'})`);
    res.json(order);
  } catch (err: any) {
    console.error('[Alpaca] Order error:', err?.message);
    res.status(502).json({ error: 'Failed to place order' });
  }
});

// DELETE /api/alpaca/orders/:id — Cancel an order
router.delete('/orders/:id', async (req, res) => {
  const { alpacaApiKey, alpacaSecretKey, alpacaPaper } = req.user!;
  if (!alpacaApiKey || !alpacaSecretKey) {
    return res.status(400).json({ error: 'Alpaca not connected' });
  }

  try {
    await alpacaFetch(
      alpacaApiKey, alpacaSecretKey, alpacaPaper,
      `/v2/orders/${req.params.id}`,
      { method: 'DELETE' },
    );
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[Alpaca] Cancel error:', err?.message);
    res.status(502).json({ error: 'Failed to cancel order' });
  }
});

export default router;
