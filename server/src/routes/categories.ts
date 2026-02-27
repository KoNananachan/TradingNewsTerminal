import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

// GET /api/categories
router.get('/', async (req, res) => {
  try {
    const categories = await prisma.newsCategory.findMany({
      include: { _count: { select: { articles: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(categories);
  } catch (err) {
    console.error('[Categories] Error:', err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

export default router;
