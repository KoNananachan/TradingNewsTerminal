import { Router } from 'express';
import { getCorrelationMatrix } from '../services/stocks/correlation.js';

const router = Router();

// In-memory cache (10 min TTL — correlations change slowly)
const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 10 * 60_000;

const CORRELATION_ASSETS = ['^GSPC', '^IXIC', 'GC=F', 'CL=F', 'BTC-USD', 'DX-Y.NYB', '^TNX', '^VIX'];
const DISPLAY_NAMES = ['S&P 500', 'NASDAQ', 'Gold', 'Oil', 'Bitcoin', 'DXY', '10Y Treasury', 'VIX'];

// GET /api/correlations - asset correlation matrix
router.get('/', async (req, res) => {
  try {
    const period = (req.query.period as string) || '3M';
    if (!['1M', '3M', '6M', '1Y'].includes(period)) {
      res.status(400).json({ error: 'Invalid period. Use 1M, 3M, 6M, or 1Y' });
      return;
    }

    const cacheKey = `corr:${period}`;
    const entry = cache.get(cacheKey);
    if (entry && Date.now() - entry.ts < CACHE_TTL) {
      res.json(entry.data);
      return;
    }

    const result = await getCorrelationMatrix(CORRELATION_ASSETS, period);
    const payload = {
      symbols: result.symbols,
      names: DISPLAY_NAMES,
      matrix: result.matrix,
    };
    cache.set(cacheKey, { data: payload, ts: Date.now() });

    res.json(payload);
  } catch (err) {
    console.error('[Correlations] Error computing correlation matrix:', err);
    res.status(500).json({ error: 'Failed to compute correlations' });
  }
});

export default router;
