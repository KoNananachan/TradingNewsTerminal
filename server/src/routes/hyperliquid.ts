import { Router, type Request, type Response } from 'express';
import {
  getHlPerps,
  getHlStockPerps,
  getHlAsset,
  getHlLastUpdated,
} from '../services/hyperliquid/hl-tracker.js';

const router = Router();

// GET /api/hyperliquid/markets — all Hyperliquid markets (perps + stock perps)
router.get('/markets', (_req: Request, res: Response) => {
  const perps = getHlPerps();
  const stockPerps = getHlStockPerps();
  res.json({
    perps,
    stockPerps,
    updatedAt: getHlLastUpdated(),
  });
});

// GET /api/hyperliquid/perps — crypto/commodity perpetual contracts
router.get('/perps', (_req: Request, res: Response) => {
  res.json(getHlPerps());
});

// GET /api/hyperliquid/stock-perps — stock perpetual contracts (xyz dex)
router.get('/stock-perps', (_req: Request, res: Response) => {
  res.json(getHlStockPerps());
});

// GET /api/hyperliquid/asset/:symbol — detailed info for a single asset
router.get('/asset/:symbol', (req: Request, res: Response) => {
  // Support both "BTC" and "xyz:NVDA" (URL-encoded as "xyz%3ANVDA")
  const symbol = decodeURIComponent(String(req.params.symbol));
  const asset = getHlAsset(symbol);
  if (!asset) {
    return res.status(404).json({ error: 'Asset not found' });
  }
  res.json(asset);
});

export default router;
