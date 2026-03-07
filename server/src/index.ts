import { env } from './config/env.js';
import { createApp } from './app.js';
import { startWebSocketServer } from './services/websocket/ws-server.js';
import { startScraperScheduler } from './services/scraper/scraper-scheduler.js';
import { startStockTracker } from './services/stocks/stock-tracker.js';
import { seedDatabase } from './lib/seed.js';
import { backupDatabase } from './lib/gcs-backup.js';
import { startCalendarTracker } from './services/calendar/calendar-tracker.js';
import { startInsiderTracker } from './services/stocks/insider-tracker.js';
import { startDataRetention } from './services/data-retention.js';
import { fetchConflicts } from './services/acled/acled-client.js';
import { prisma } from './lib/prisma.js';

const app = createApp();

const server = app.listen(env.PORT, async () => {
  // Keep-alive > Cloud Run's 60s idle timeout
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  console.log(`[Server] HTTP server running on port ${env.PORT}`);

  try {
    await seedDatabase();
  } catch (err) {
    console.error('[Server] Database seeding failed:', err);
  }

  startWebSocketServer(server);
  startScraperScheduler();
  startStockTracker();
  startCalendarTracker();
  startInsiderTracker();
  startDataRetention();

  // Pre-warm conflicts cache so first client request is instant
  fetchConflicts().catch(() => {});

  // Clean up expired sessions and verification codes every hour
  setInterval(async () => {
    try {
      const now = new Date();
      const [sessions, codes] = await Promise.all([
        prisma.authSession.deleteMany({ where: { expiresAt: { lt: now } } }),
        prisma.verificationCode.deleteMany({ where: { expiresAt: { lt: now } } }),
      ]);
      if (sessions.count || codes.count) {
        console.log(`[Auth] Cleaned ${sessions.count} expired sessions, ${codes.count} expired codes`);
      }
    } catch (err) {
      console.error('[Auth] Cleanup error:', err);
    }
  }, 60 * 60 * 1000);

  // Periodic database backup to GCS
  if (env.GCS_BUCKET) {
    const intervalMs = env.GCS_BACKUP_INTERVAL_MINUTES * 60 * 1000;
    setInterval(() => backupDatabase(), intervalMs);
    console.log(`[GCS] Backup scheduled every ${env.GCS_BACKUP_INTERVAL_MINUTES} minutes`);
  }

  console.log('[Server] All services started');
});

// ── Graceful Shutdown ──
async function shutdown(signal: string) {
  console.log(`\n[Server] ${signal} received — shutting down gracefully...`);
  server.close(async () => {
    try {
      // Final backup before shutdown to prevent data loss
      if (env.GCS_BUCKET) {
        console.log('[Server] Running final database backup...');
        await backupDatabase();
      }
      await prisma.$disconnect();
      console.log('[Server] Database disconnected');
    } catch (err) {
      console.error('[Server] Error during shutdown:', err);
    }
    process.exit(0);
  });
  // Force exit after 10s if graceful shutdown hangs
  setTimeout(() => {
    console.error('[Server] Forced exit after timeout');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Catch unhandled errors to prevent silent crashes
process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught exception:', err);
  // Give the server a moment to log, then exit
  setTimeout(() => process.exit(1), 1000);
});
