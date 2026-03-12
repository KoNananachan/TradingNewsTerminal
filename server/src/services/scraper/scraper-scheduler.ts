import { scrapeArticles, createNewsSource } from './neuberg-scraper.js';
import { analyzeUnprocessedArticles } from '../ai/news-analyzer.js';
import { clusterRecentNews } from '../ai/news-clusterer.js';
import type { NewsSource } from './news-source.js';

const POLL_INTERVAL_MS = 30_000; // 30 seconds
const CLUSTER_INTERVAL_MS = 10 * 60_000; // 10 minutes
let lastClusterTime = 0;
let newsSource: NewsSource | null = null;

export function startScraperScheduler() {
  newsSource = createNewsSource();
  if (!newsSource) {
    console.log('[Scheduler] No news source configured — only AI analysis will run');
  } else {
    console.log(`[Scheduler] Polling ${newsSource.name} every ${POLL_INTERVAL_MS / 1000}s`);
  }

  // Run immediately on start
  runScrapeAndAnalyze();

  // Then poll at interval
  setInterval(() => {
    runScrapeAndAnalyze();
  }, POLL_INTERVAL_MS);
}

async function runScrapeAndAnalyze() {
  try {
    const newCount = await scrapeArticles(newsSource);
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
