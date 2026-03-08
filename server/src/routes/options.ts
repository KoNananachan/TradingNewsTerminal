import { Router } from 'express';
import { getOptionsFlow } from '../services/stocks/options-flow.js';

const router = Router();

// GET /api/options/flow - get unusual options activity
router.get('/flow', async (req, res) => {
  try {
    const symbolsParam = (req.query.symbols as string) || '';
    const rawPremium = parseInt(req.query.minPremium as string);
    const minPremium = isNaN(rawPremium) || rawPremium < 0 ? 50000 : rawPremium;

    if (!symbolsParam) {
      res.status(400).json({ error: 'symbols query parameter is required (comma-separated)' });
      return;
    }

    const symbols = symbolsParam
      .split(',')
      .map(s => s.trim().toUpperCase())
      .filter(Boolean);

    if (symbols.length === 0) {
      res.status(400).json({ error: 'At least one symbol is required' });
      return;
    }

    if (symbols.length > 20) {
      res.status(400).json({ error: 'Maximum 20 symbols allowed' });
      return;
    }

    const flow = await getOptionsFlow(symbols);

    // Filter by minimum premium
    const filtered = flow.filter(o => o.premium >= minPremium);

    res.json(filtered);
  } catch (err) {
    console.error('[Options] Error fetching options flow:', err);
    res.status(500).json({ error: 'Failed to fetch options flow' });
  }
});

export default router;
