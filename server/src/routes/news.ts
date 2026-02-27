import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

// GET /api/news - list articles with pagination, category filter, search
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const category = req.query.category as string | undefined;
    const search = req.query.search as string | undefined;
    const sentiment = req.query.sentiment as string | undefined;

    const where: any = {};
    if (category) where.categorySlug = category;
    if (sentiment) where.sentiment = sentiment;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { content: { contains: search } },
        { summary: { contains: search } },
      ];
    }

    const [articles, total] = await Promise.all([
      prisma.newsArticle.findMany({
        where,
        include: { category: true, recommendations: true },
        orderBy: { scrapedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.newsArticle.count({ where }),
    ]);

    res.json({
      articles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('[News] Error fetching articles:', err);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
});

// GET /api/news/:id - single article detail
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid article ID' });
      return;
    }

    const article = await prisma.newsArticle.findUnique({
      where: { id },
      include: { category: true, recommendations: true },
    });

    if (!article) {
      res.status(404).json({ error: 'Article not found' });
      return;
    }

    res.json(article);
  } catch (err) {
    console.error('[News] Error fetching article:', err);
    res.status(500).json({ error: 'Failed to fetch article' });
  }
});

export default router;
