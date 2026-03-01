import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

// GET /api/clusters - list news clusters
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const minImpact = parseFloat(req.query.minImpact as string) || 0;

    const clusters = await prisma.newsCluster.findMany({
      where: {
        impactScore: { gte: minImpact },
      },
      include: {
        articles: {
          include: {
            cluster: false,
          },
        },
      },
      orderBy: { impactScore: 'desc' },
      take: limit,
    });

    // Fetch article details for each cluster
    const result = await Promise.all(
      clusters.map(async (cluster) => {
        const articleIds = cluster.articles.map(a => a.articleId);

        const articleDetails = await prisma.newsArticle.findMany({
          where: { id: { in: articleIds } },
          select: {
            id: true,
            title: true,
            url: true,
            scrapedAt: true,
            sentiment: true,
            sentimentScore: true,
            categorySlug: true,
            recommendations: {
              select: { symbol: true, action: true },
            },
          },
        });

        return {
          id: cluster.id,
          title: cluster.title,
          summary: cluster.summary,
          impactScore: cluster.impactScore,
          category: cluster.category,
          tickers: cluster.tickers ? cluster.tickers.split(',') : [],
          articleCount: cluster.articleCount,
          avgSentiment: cluster.avgSentiment,
          createdAt: cluster.createdAt,
          updatedAt: cluster.updatedAt,
          articles: articleDetails,
        };
      })
    );

    res.json(result);
  } catch (err) {
    console.error('[Clusters] Error fetching clusters:', err);
    res.status(500).json({ error: 'Failed to fetch clusters' });
  }
});

export default router;
