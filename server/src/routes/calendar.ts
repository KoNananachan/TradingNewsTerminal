import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// GET /api/calendar - list economic events with filters
router.get('/', async (req, res) => {
  try {
    const now = new Date();
    const from = (req.query.from as string) || toDateString(now);
    const to = (req.query.to as string) || toDateString(new Date(now.getTime() + 14 * 24 * 60 * 60_000));

    if (from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) return res.status(400).json({ error: 'Invalid date format, use YYYY-MM-DD' });
    if (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) return res.status(400).json({ error: 'Invalid date format, use YYYY-MM-DD' });

    const country = req.query.country as string | undefined;
    const impact = req.query.impact as string | undefined;

    const where: any = {
      date: {
        gte: new Date(from),
        lte: new Date(to + 'T23:59:59.999Z'),
      },
    };

    if (country) where.country = country;
    if (impact) where.impact = impact;

    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit as string) || 200));
    const events = await prisma.economicEvent.findMany({
      where,
      orderBy: { date: 'asc' },
      take: limit,
    });

    res.json(events);
  } catch (err) {
    console.error('[Calendar] Error fetching events:', err);
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

// GET /api/calendar/upcoming - next 10 upcoming unreleased events
router.get('/upcoming', async (req, res) => {
  try {
    const events = await prisma.economicEvent.findMany({
      where: {
        date: { gte: new Date() },
        released: false,
      },
      orderBy: { date: 'asc' },
      take: 10,
    });

    res.json(events);
  } catch (err) {
    console.error('[Calendar] Error fetching upcoming events:', err);
    res.status(500).json({ error: 'Failed to fetch upcoming events' });
  }
});

export default router;
