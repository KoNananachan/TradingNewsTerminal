import { scrapeArticles } from './tradingnews-scraper.js';
import { analyzeUnprocessedArticles } from '../ai/news-analyzer.js';
import { clusterRecentNews } from '../ai/news-clusterer.js';

const POLL_INTERVAL_MS = 30_000; // 30 seconds
const CLUSTER_INTERVAL_MS = 10 * 60_000; // 10 minutes
let lastClusterTime = 0;

export function startScraperScheduler() {
  console.log(`[Scheduler] Polling API every ${POLL_INTERVAL_MS / 1000}s`);

  // Run immediately on start
  runScrapeAndAnalyze();

  // Then poll at interval
  setInterval(() => {
    runScrapeAndAnalyze();
  }, POLL_INTERVAL_MS);
}

async function runScrapeAndAnalyze() {
  try {
    const newCount = await scrapeArticles();
    if (newCount > 0) {
      await analyzeUnprocessedArticles();
    }

    // Re-cluster periodically (every 10 minutes)
    const now = Date.now();
    if (now - lastClusterTime > CLUSTER_INTERVAL_MS) {
      lastClusterTime = now;
      await clusterRecentNews().catch(err =>
        console.error('[Scheduler] Clustering error:', err)
      );
    }
  } catch (err) {
    console.error('[Scheduler] Error in scrape cycle:', err);
  }
}

export { runScrapeAndAnalyze };
