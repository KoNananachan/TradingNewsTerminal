import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

// In-memory cache for map events (refreshed at most every 15s)
let mapEventsCache: { data: any[]; expiresAt: number } | null = null;

// GET /api/map-events - news articles with lat/lng for map display
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 100));

    // Serve from cache if still fresh (reduces DB load for frequent polling)
    if (mapEventsCache && Date.now() < mapEventsCache.expiresAt && limit <= 100) {
      return res.json(mapEventsCache.data);
    }

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
        titleTranslations: true,
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
      orderBy: [{ publishedAt: 'desc' }, { scrapedAt: 'desc' }],
      take: limit,
    });

    // Cache default-limit results for 15 seconds
    if (limit <= 100) {
      mapEventsCache = { data: articles, expiresAt: Date.now() + 15_000 };
    }

    res.json(articles);
  } catch (err) {
    console.error('[MapEvents] Error:', err);
    // Return stale cache on error if available
    if (mapEventsCache) return res.json(mapEventsCache.data);
    res.status(500).json({ error: 'Failed to fetch map events' });
  }
});

export default router;
