import { scrapeArticles } from './tradingnews-scraper.js';
import { analyzeUnprocessedArticles } from '../ai/news-analyzer.js';

const POLL_INTERVAL_MS = 30_000; // 30 seconds

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
  } catch (err) {
    console.error('[Scheduler] Error in scrape cycle:', err);
  }
}

export { runScrapeAndAnalyze };
