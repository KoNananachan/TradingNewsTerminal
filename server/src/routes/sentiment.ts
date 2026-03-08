import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

type WindowType = '1D' | '1W' | '1M';

function getWindowConfig(window: WindowType): { startDate: Date; bucketMs: number; bucketLabel: string } {
  const now = new Date();
  switch (window) {
    case '1D':
      return {
        startDate: new Date(now.getTime() - 24 * 60 * 60_000),
        bucketMs: 60 * 60_000, // 1 hour
        bucketLabel: 'hour',
      };
    case '1W':
      return {
        startDate: new Date(now.getTime() - 7 * 24 * 60 * 60_000),
        bucketMs: 24 * 60 * 60_000, // 1 day
        bucketLabel: 'day',
      };
    case '1M':
    default:
      return {
        startDate: new Date(now.getTime() - 30 * 24 * 60 * 60_000),
        bucketMs: 24 * 60 * 60_000, // 1 day
        bucketLabel: 'day',
      };
  }
}

function bucketKey(date: Date, bucketLabel: string): string {
  if (bucketLabel === 'hour') {
    return date.toISOString().slice(0, 13) + ':00:00Z';
  }
  return date.toISOString().slice(0, 10);
}

function detectReversal(buckets: Array<{ avgScore: number }>): boolean {
  if (buckets.length < 2) return false;

  for (let i = 1; i < buckets.length; i++) {
    const prev = buckets[i - 1].avgScore;
    const curr = buckets[i].avgScore;

    // Zero-point crossing
    if ((prev > 0 && curr < 0) || (prev < 0 && curr > 0)) {
      return true;
    }

    // Single-bucket change > 0.3
    if (Math.abs(curr - prev) > 0.3) {
      return true;
    }
  }

  return false;
}

// GET /api/sentiment/trend
router.get('/trend', async (req, res) => {
  try {
    const scope = (req.query.scope as string) || 'market';
    const value = (req.query.value as string) || '';
    const window = ((req.query.window as string) || '1W') as WindowType;

    if (!['1D', '1W', '1M'].includes(window)) {
      res.status(400).json({ error: 'Invalid window. Use 1D, 1W, or 1M' });
      return;
    }

    const { startDate, bucketLabel } = getWindowConfig(window);

    // Build base query conditions
    const where: any = {
      scrapedAt: { gte: startDate },
      sentimentScore: { not: null },
    };

    if (scope === 'ticker' && value) {
      const sym = value.toUpperCase().slice(0, 10);
      if (!/^[A-Z0-9.\-]{1,10}$/.test(sym)) {
        return res.status(400).json({ error: 'Invalid symbol format' });
      }
      where.recommendations = {
        some: { symbol: sym },
      };
    } else if (scope === 'category' && value) {
      if (!/^[a-z0-9-]{1,50}$/.test(value)) {
        return res.status(400).json({ error: 'Invalid category slug' });
      }
      where.categorySlug = value;
    }
    // scope === 'market' => no additional filter

    const articles = await prisma.newsArticle.findMany({
      where,
      select: {
        scrapedAt: true,
        sentimentScore: true,
      },
      orderBy: { scrapedAt: 'asc' },
      take: 2000,
    });

    // Group into time buckets
    const bucketMap = new Map<string, { total: number; count: number }>();

    for (const article of articles) {
      if (article.sentimentScore == null) continue;
      const key = bucketKey(article.scrapedAt, bucketLabel);
      const existing = bucketMap.get(key);
      if (existing) {
        existing.total += article.sentimentScore;
        existing.count += 1;
      } else {
        bucketMap.set(key, { total: article.sentimentScore, count: 1 });
      }
    }

    const buckets = Array.from(bucketMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([time, { total, count }]) => ({
        time,
        avgScore: Math.round((total / count) * 1000) / 1000,
        count,
      }));

    const reversal = detectReversal(buckets);

    res.json({ buckets, reversal });
  } catch (err) {
    console.error('[Sentiment] Error fetching trend:', err);
    res.status(500).json({ error: 'Failed to fetch sentiment trend' });
  }
});

export default router;
