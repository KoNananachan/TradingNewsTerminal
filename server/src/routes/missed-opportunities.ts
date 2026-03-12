import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { getHistory } from '../services/stocks/yahoo-finance.js';

const router = Router();

interface Opportunity {
  symbol: string;
  action: string;
  confidence: number;
  reason: string | null;
  reasonTranslations: string | null;
  articleTitle: string;
  titleTranslations: string | null;
  articleId: number | null;
  publishedAt: string;
  priceAtNews: number;
  return1d: number | null;
  return3d: number | null;
  return5d: number | null;
  bestReturn: number;
}

// In-memory cache (refreshed every 15 min)
let cache: { data: Opportunity[]; expiresAt: number } | null = null;
const CACHE_TTL = 15 * 60_000;

// GET /api/missed-opportunities
router.get('/', async (_req, res) => {
  try {
    if (cache && Date.now() < cache.expiresAt) {
      return res.json(cache.data);
    }

    const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Get all BUY recommendations from the past month
    const recs = await prisma.stockRecommendation.findMany({
      where: {
        createdAt: { gte: oneMonthAgo },
        action: 'BUY',
      },
      include: {
        article: {
          select: {
            id: true,
            title: true,
            titleTranslations: true,
            publishedAt: true,
            scrapedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recs.length === 0) {
      cache = { data: [], expiresAt: Date.now() + CACHE_TTL };
      return res.json([]);
    }

    // Collect unique symbols
    const symbols = [...new Set(recs.map(r => r.symbol))];

    // Fetch 3-month daily history for each symbol (covers 1 month of recs + 5 trading days forward)
    const historyMap = new Map<string, { date: string; close: number }[]>();

    // Batch fetch in groups of 5 to avoid rate limits
    for (let i = 0; i < symbols.length; i += 5) {
      const batch = symbols.slice(i, i + 5);
      const results = await Promise.all(
        batch.map(async (sym) => {
          const history = await getHistory(sym, { range: '3mo', interval: '1d' });
          return {
            symbol: sym,
            data: history
              .filter((h: any) => h.close != null)
              .map((h: any) => ({ date: h.date as string, close: h.close as number })),
          };
        }),
      );
      for (const r of results) {
        if (r.data.length > 0) historyMap.set(r.symbol, r.data);
      }
    }

    // Calculate returns for each recommendation
    const opportunities: Opportunity[] = [];

    for (const rec of recs) {
      const history = historyMap.get(rec.symbol);
      if (!history || history.length < 2) continue;

      // Use denormalized publishedAt first, fall back to article
      const articleDate = rec.publishedAt || rec.article?.publishedAt || rec.article?.scrapedAt;
      if (!articleDate) continue;
      const articleDateStr = new Date(articleDate).toISOString().slice(0, 10);

      // Find the trading day on or after the article date
      const dayIndex = history.findIndex(h => h.date >= articleDateStr);
      if (dayIndex < 0) continue;

      const priceAtNews = history[dayIndex].close;
      if (!priceAtNews || priceAtNews <= 0) continue;

      // Calculate returns at 1, 3, 5 trading days
      const getReturn = (offset: number): number | null => {
        const idx = dayIndex + offset;
        if (idx >= history.length) return null;
        const futurePrice = history[idx].close;
        if (!futurePrice) return null;
        return ((futurePrice - priceAtNews) / priceAtNews) * 100;
      };

      const return1d = getReturn(1);
      const return3d = getReturn(3);
      const return5d = getReturn(5);

      // Best return across available periods
      const returns = [return1d, return3d, return5d].filter((r): r is number => r !== null);
      if (returns.length === 0) continue;
      const bestReturn = Math.max(...returns);

      // Only include opportunities that matched the prediction (positive return)
      if (bestReturn <= 0) continue;

      // Use denormalized fields, fall back to article relation
      const title = rec.articleTitle || rec.article?.title || rec.symbol;
      const titleTrans = rec.titleTranslations || rec.article?.titleTranslations || null;

      opportunities.push({
        symbol: rec.symbol,
        action: rec.action,
        confidence: rec.confidence,
        reason: rec.reason,
        reasonTranslations: rec.reasonTranslations,
        articleTitle: title,
        titleTranslations: titleTrans,
        articleId: rec.articleId,
        publishedAt: (articleDate as Date).toISOString(),
        priceAtNews,
        return1d,
        return3d,
        return5d,
        bestReturn,
      });
    }

    // Sort by best return descending, take top 100
    opportunities.sort((a, b) => b.bestReturn - a.bestReturn);
    const top100 = opportunities.slice(0, 100);

    cache = { data: top100, expiresAt: Date.now() + CACHE_TTL };
    console.log(`[MissedOpp] Computed ${opportunities.length} opportunities, returning top ${top100.length}`);
    res.json(top100);
  } catch (err) {
    console.error('[MissedOpp] Error:', err);
    if (cache) return res.json(cache.data);
    res.status(500).json({ error: 'Failed to compute missed opportunities' });
  }
});

export default router;
