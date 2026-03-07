import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// All alerts routes require authentication
router.use(requireAuth);

const createAlertSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['price_cross', 'price_change_pct', 'sentiment_shift', 'news_keyword', 'volume_spike']),
  symbol: z.string().max(20).optional().nullable(),
  condition: z.string().min(2), // JSON string
});

const updateAlertSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  type: z.enum(['price_cross', 'price_change_pct', 'sentiment_shift', 'news_keyword', 'volume_spike']).optional(),
  symbol: z.string().max(20).optional().nullable(),
  condition: z.string().min(2).optional(),
  enabled: z.boolean().optional(),
});

// GET /api/alerts - list all alerts with trigger count
router.get('/', async (_req, res) => {
  try {
    const alerts = await prisma.alert.findMany({
      include: {
        _count: { select: { triggers: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = alerts.map(alert => ({
      ...alert,
      triggerCount: alert._count.triggers,
      _count: undefined,
    }));

    res.json(result);
  } catch (err) {
    console.error('[Alerts] Error fetching alerts:', err);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// POST /api/alerts - create alert
router.post('/', async (req, res) => {
  try {
    const parsed = createAlertSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
      return;
    }

    // Validate that condition is valid JSON
    try {
      JSON.parse(parsed.data.condition);
    } catch {
      res.status(400).json({ error: 'Condition must be valid JSON' });
      return;
    }

    if (parsed.data.condition && parsed.data.condition.length > 2000) {
      return res.status(400).json({ error: 'Condition too large' });
    }

    const alert = await prisma.alert.create({
      data: {
        name: parsed.data.name,
        type: parsed.data.type,
        symbol: parsed.data.symbol ?? null,
        condition: parsed.data.condition,
      },
    });

    res.status(201).json(alert);
  } catch (err) {
    console.error('[Alerts] Error creating alert:', err);
    res.status(500).json({ error: 'Failed to create alert' });
  }
});

// PUT /api/alerts/:id - update alert
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid alert ID' });
      return;
    }

    const parsed = updateAlertSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
      return;
    }

    if (parsed.data.condition) {
      try {
        JSON.parse(parsed.data.condition);
      } catch {
        res.status(400).json({ error: 'Condition must be valid JSON' });
        return;
      }
    }

    const existing = await prisma.alert.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }

    const alert = await prisma.alert.update({
      where: { id },
      data: parsed.data,
    });

    res.json(alert);
  } catch (err) {
    console.error('[Alerts] Error updating alert:', err);
    res.status(500).json({ error: 'Failed to update alert' });
  }
});

// DELETE /api/alerts/:id - delete alert
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid alert ID' });
      return;
    }

    const existing = await prisma.alert.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }

    await prisma.alert.delete({ where: { id } });

    res.json({ message: 'Alert deleted' });
  } catch (err) {
    console.error('[Alerts] Error deleting alert:', err);
    res.status(500).json({ error: 'Failed to delete alert' });
  }
});

export default router;
