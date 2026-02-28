import { Router } from 'express';
import { fetchConflicts } from '../services/acled/acled-client.js';

const router = Router();

// GET /api/conflicts - ACLED conflict events for map display
router.get('/', async (_req, res) => {
  try {
    const data = await fetchConflicts();
    res.json(data);
  } catch (err) {
    console.error('[Conflicts] Error:', err);
    res.status(500).json({ error: 'Failed to fetch conflict data' });
  }
});

export default router;
