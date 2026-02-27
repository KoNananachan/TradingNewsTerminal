import { env } from './config/env.js';
import { createApp } from './app.js';
import { startWebSocketServer } from './services/websocket/ws-server.js';
import { startScraperScheduler } from './services/scraper/scraper-scheduler.js';
import { startStockTracker } from './services/stocks/stock-tracker.js';
import { seedDatabase } from './lib/seed.js';
import { backupDatabase } from './lib/gcs-backup.js';

const app = createApp();

const server = app.listen(env.PORT, async () => {
  console.log(`[Server] HTTP server running on port ${env.PORT}`);

  await seedDatabase();
  startWebSocketServer(server);
  startScraperScheduler();
  startStockTracker();

  // Periodic database backup to GCS
  if (env.GCS_BUCKET) {
    const intervalMs = env.GCS_BACKUP_INTERVAL_MINUTES * 60 * 1000;
    setInterval(() => backupDatabase(), intervalMs);
    console.log(`[GCS] Backup scheduled every ${env.GCS_BACKUP_INTERVAL_MINUTES} minutes`);
  }

  console.log('[Server] All services started');
});
