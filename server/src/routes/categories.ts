import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

// Priority ordering: these slugs appear first, in this order
const PRIORITY_ORDER = ['geopolitics', 'tech', 'earnings'];

// GET /api/categories
router.get('/', async (req, res) => {
  try {
    const categories = await prisma.newsCategory.findMany({
      include: { _count: { select: { articles: true } } },
    });

    // Sort: priority slugs first (in specified order), then the rest alphabetically
    categories.sort((a, b) => {
      const ai = PRIORITY_ORDER.indexOf(a.slug);
      const bi = PRIORITY_ORDER.indexOf(b.slug);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.name.localeCompare(b.name);
    });

    res.json(categories);
  } catch (err) {
    console.error('[Categories] Error:', err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

export default router;
