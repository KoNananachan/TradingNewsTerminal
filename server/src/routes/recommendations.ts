import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requirePro } from '../middleware/auth.js';

const router = Router();
router.use(requirePro);

// GET /api/recommendations - recent AI recommendations
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const symbol = req.query.symbol as string | undefined;

    const where: any = {};
    if (symbol) where.symbol = symbol.toUpperCase();

    const recommendations = await prisma.stockRecommendation.findMany({
      where,
      include: {
        article: {
          select: { id: true, title: true, sentiment: true, sentimentScore: true, scrapedAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    res.json(recommendations);
  } catch (err) {
    console.error('[Recommendations] Error:', err);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});

export default router;
