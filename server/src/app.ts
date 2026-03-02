import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import newsRouter from './routes/news.js';
import stocksRouter from './routes/stocks.js';
import recommendationsRouter from './routes/recommendations.js';
import categoriesRouter from './routes/categories.js';
import mapEventsRouter from './routes/map-events.js';
import watchlistRouter from './routes/watchlist.js';
import auditRouter from './routes/audit.js';
import chatRouter from './routes/chat.js';
import conflictsRouter from './routes/conflicts.js';
import sentimentRouter from './routes/sentiment.js';
import sectorsRouter from './routes/sectors.js';
import calendarRouter from './routes/calendar.js';
import alertsRouter from './routes/alerts.js';
import clustersRouter from './routes/clusters.js';
import optionsRouter from './routes/options.js';
import insidersRouter from './routes/insiders.js';
import correlationsRouter from './routes/correlations.js';
import authRouter from './routes/auth.js';
import billingRouter, { billingWebhookHandler } from './routes/billing.js';
import alpacaRouter from './routes/alpaca.js';
import { attachUser } from './middleware/auth.js';
import { runScrapeAndAnalyze } from './services/scraper/scraper-scheduler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();

  // Support BigInt serialization in JSON responses
  app.set('json replacer', (_key: string, value: unknown) =>
    typeof value === 'bigint' ? Number(value) : value,
  );

  // Stripe webhook must come BEFORE express.json() — needs raw body
  app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), billingWebhookHandler);

  app.use(cors({ origin: true, credentials: true }));
  app.use(cookieParser());
  app.use(express.json());
  app.use(attachUser);

  // Routes
  app.use('/api/auth', authRouter);
  app.use('/api/billing', billingRouter);
  app.use('/api/alpaca', alpacaRouter);
  app.use('/api/news', newsRouter);
  app.use('/api/stocks', stocksRouter);
  app.use('/api/recommendations', recommendationsRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/map-events', mapEventsRouter);
  app.use('/api/watchlist', watchlistRouter);
  app.use('/api/audit', auditRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/conflicts', conflictsRouter);
  app.use('/api/sentiment', sentimentRouter);
  app.use('/api/sectors', sectorsRouter);
  app.use('/api/calendar', calendarRouter);
  app.use('/api/alerts', alertsRouter);
  app.use('/api/clusters', clustersRouter);
  app.use('/api/options', optionsRouter);
  app.use('/api/insiders', insidersRouter);
  app.use('/api/correlations', correlationsRouter);

  // Manual scrape trigger
  app.post('/api/scrape', async (_req, res) => {
    try {
      runScrapeAndAnalyze();
      res.json({ message: 'Scrape triggered' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to trigger scrape' });
    }
  });

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Static files — serve client build in production
  const clientDist = path.resolve(__dirname, '..', '..', 'client', 'dist');
  app.use(express.static(clientDist));

  // SPA fallback — serve index.html for all non-API routes
  app.get('/{*splat}', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });

  return app;
}
