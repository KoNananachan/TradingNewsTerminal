import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

// GET /api/map-events - news articles with lat/lng for map display
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 100));

    const articles = await prisma.newsArticle.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
        locationName: { not: null },
        NOT: [
          { latitude: 0, longitude: 0 },
        ],
      },
      select: {
        id: true,
        title: true,
        summary: true,
        url: true,
        imageUrl: true,
        categorySlug: true,
        category: true,
        sentiment: true,
        sentimentScore: true,
        locationName: true,
        latitude: true,
        longitude: true,
        scrapedAt: true,
        recommendations: {
          select: { symbol: true, action: true },
        },
      },
      orderBy: { scrapedAt: 'desc' },
      take: limit,
    });

    res.json(articles);
  } catch (err) {
    console.error('[MapEvents] Error:', err);
    res.status(500).json({ error: 'Failed to fetch map events' });
  }
});

export default router;
