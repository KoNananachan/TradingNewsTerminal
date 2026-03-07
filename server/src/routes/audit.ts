import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// All audit GET endpoints require authentication


// ── Validation Schemas ──

const sessionSchema = z.object({
  walletAddress: z.string().min(1),
  chainId: z.number().optional(),
  eventType: z.enum(['connect', 'disconnect']),
  userAgent: z.string().optional(),
});

const tradeSchema = z.object({
  walletAddress: z.string().min(1),
  coin: z.string().min(1),
  side: z.enum(['buy', 'sell']),
  orderType: z.enum(['market', 'limit']),
  size: z.number().positive(),
  price: z.number().optional(),
  leverage: z.number().int().min(1).default(1),
  midPrice: z.number().optional(),
  notionalValue: z.number().optional(),
  marginRequired: z.number().optional(),
  status: z.enum(['demo', 'submitted', 'filled']).default('demo'),
  sourceArticleId: z.number().int().optional(),
});

// ── POST Endpoints ──

// POST /api/audit/session — record wallet connect/disconnect
router.post('/session', async (req, res) => {
  try {
    const data = sessionSchema.parse(req.body);
    const session = await prisma.userSession.create({ data });
    res.status(201).json(session);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error('[Audit] Error creating session:', err);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// POST /api/audit/trade — record trade order
router.post('/trade', async (req, res) => {
  try {
    const data = tradeSchema.parse(req.body);
    const trade = await prisma.tradeOrder.create({ data });
    res.status(201).json(trade);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error('[Audit] Error creating trade:', err);
    res.status(500).json({ error: 'Failed to create trade' });
  }
});

// ── GET Endpoints ──

// GET /api/audit/scrape-runs?limit=20
router.get('/scrape-runs', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const runs = await prisma.scrapeRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
    res.json(runs);
  } catch (err) {
    console.error('[Audit] Error fetching scrape runs:', err);
    res.status(500).json({ error: 'Failed to fetch scrape runs' });
  }
});

// GET /api/audit/ai-logs?articleId=X&limit=20
router.get('/ai-logs', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const articleId = req.query.articleId ? parseInt(req.query.articleId as string) : undefined;

    const where: any = {};
    if (articleId && !isNaN(articleId)) where.articleId = articleId;

    const logs = await prisma.aiAnalysisLog.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
    res.json(logs);
  } catch (err) {
    console.error('[Audit] Error fetching AI logs:', err);
    res.status(500).json({ error: 'Failed to fetch AI logs' });
  }
});

// GET /api/audit/trades?wallet=0x...&limit=50
router.get('/trades', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));
    const wallet = req.query.wallet as string | undefined;

    const where: any = {};
    if (wallet) where.walletAddress = wallet;

    const trades = await prisma.tradeOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    res.json(trades);
  } catch (err) {
    console.error('[Audit] Error fetching trades:', err);
    res.status(500).json({ error: 'Failed to fetch trades' });
  }
});

// GET /api/audit/sessions?wallet=0x...&limit=50
router.get('/sessions', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));
    const wallet = req.query.wallet as string | undefined;

    const where: any = {};
    if (wallet) where.walletAddress = wallet;

    const sessions = await prisma.userSession.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    res.json(sessions);
  } catch (err) {
    console.error('[Audit] Error fetching sessions:', err);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// GET /api/audit/stats — aggregated statistics
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const [
      totalScrapes,
      successScrapes,
      totalAiCalls,
      successAiCalls,
      totalTrades,
      totalSessions,
      uniqueWallets,
    ] = await Promise.all([
      prisma.scrapeRun.count(),
      prisma.scrapeRun.count({ where: { status: 'success' } }),
      prisma.aiAnalysisLog.count(),
      prisma.aiAnalysisLog.count({ where: { status: 'success' } }),
      prisma.tradeOrder.count(),
      prisma.userSession.count(),
      prisma.userSession.groupBy({ by: ['walletAddress'] }).then((g) => g.length),
    ]);

    res.json({
      scraper: {
        totalRuns: totalScrapes,
        successRuns: successScrapes,
        successRate: totalScrapes > 0 ? (successScrapes / totalScrapes * 100).toFixed(1) + '%' : 'N/A',
      },
      ai: {
        totalCalls: totalAiCalls,
        successCalls: successAiCalls,
        successRate: totalAiCalls > 0 ? (successAiCalls / totalAiCalls * 100).toFixed(1) + '%' : 'N/A',
      },
      trading: {
        totalOrders: totalTrades,
      },
      users: {
        totalSessions: totalSessions,
        uniqueWallets,
      },
    });
  } catch (err) {
    console.error('[Audit] Error fetching stats:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
