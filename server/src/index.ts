import { env } from './config/env.js';
import { createApp } from './app.js';
import { startWebSocketServer } from './services/websocket/ws-server.js';
import { startScraperScheduler } from './services/scraper/scraper-scheduler.js';
import { startStockTracker } from './services/stocks/stock-tracker.js';
import { seedDatabase } from './lib/seed.js';

const app = createApp();

const server = app.listen(env.PORT, async () => {
  console.log(`[Server] HTTP server running on port ${env.PORT}`);

  await seedDatabase();
  startWebSocketServer(server);
  startScraperScheduler();
  startStockTracker();

  console.log('[Server] All services started');
});
