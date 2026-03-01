import { prisma } from '../lib/prisma.js';

const RETENTION_INTERVAL = 24 * 60 * 60_000; // 24 hours
let intervalId: ReturnType<typeof setInterval> | null = null;

async function archiveSentimentAggregates(cutoffDate: Date) {
  try {
    // Get articles that will be deleted, grouped by date + category
    const articles = await prisma.newsArticle.findMany({
      where: {
        scrapedAt: { lt: cutoffDate },
        sentimentScore: { not: null },
      },
      select: {
        scrapedAt: true,
        categorySlug: true,
        sentiment: true,
        sentimentScore: true,
        recommendations: { select: { symbol: true } },
      },
    });

    if (articles.length === 0) return;

    // Aggregate by date + scope
    const aggregates = new Map<string, {
      date: string;
      scope: string;
      scopeValue: string;
      scores: number[];
      sentiments: string[];
    }>();

    for (const article of articles) {
      if (article.sentimentScore == null) continue;
      const date = article.scrapedAt.toISOString().slice(0, 10);

      // Market-level aggregate
      const marketKey = `${date}|market|all`;
      if (!aggregates.has(marketKey)) {
        aggregates.set(marketKey, { date, scope: 'market', scopeValue: 'all', scores: [], sentiments: [] });
      }
      aggregates.get(marketKey)!.scores.push(article.sentimentScore);
      if (article.sentiment) aggregates.get(marketKey)!.sentiments.push(article.sentiment);

      // Category-level aggregate
      if (article.categorySlug) {
        const catKey = `${date}|category|${article.categorySlug}`;
        if (!aggregates.has(catKey)) {
          aggregates.set(catKey, { date, scope: 'category', scopeValue: article.categorySlug, scores: [], sentiments: [] });
        }
        aggregates.get(catKey)!.scores.push(article.sentimentScore);
        if (article.sentiment) aggregates.get(catKey)!.sentiments.push(article.sentiment);
      }

      // Ticker-level aggregates
      for (const rec of article.recommendations) {
        const tickerKey = `${date}|ticker|${rec.symbol}`;
        if (!aggregates.has(tickerKey)) {
          aggregates.set(tickerKey, { date, scope: 'ticker', scopeValue: rec.symbol, scores: [], sentiments: [] });
        }
        aggregates.get(tickerKey)!.scores.push(article.sentimentScore);
        if (article.sentiment) aggregates.get(tickerKey)!.sentiments.push(article.sentiment);
      }
    }

    // Upsert aggregates
    for (const agg of aggregates.values()) {
      const avgScore = agg.scores.reduce((a, b) => a + b, 0) / agg.scores.length;
      const bullishCount = agg.sentiments.filter(s => s === 'BULLISH').length;
      const bearishCount = agg.sentiments.filter(s => s === 'BEARISH').length;
      const neutralCount = agg.sentiments.filter(s => s === 'NEUTRAL').length;

      await prisma.sentimentArchive.upsert({
        where: {
          date_scope_scopeValue: {
            date: new Date(agg.date),
            scope: agg.scope,
            scopeValue: agg.scopeValue,
          },
        },
        create: {
          date: new Date(agg.date),
          scope: agg.scope,
          scopeValue: agg.scopeValue,
          avgScore: Math.round(avgScore * 1000) / 1000,
          articleCount: agg.scores.length,
          bullishCount,
          bearishCount,
          neutralCount,
        },
        update: {
          avgScore: Math.round(avgScore * 1000) / 1000,
          articleCount: agg.scores.length,
          bullishCount,
          bearishCount,
          neutralCount,
        },
      });
    }

    console.log(`[DataRetention] Archived ${aggregates.size} sentiment aggregates`);
  } catch (err) {
    console.error('[DataRetention] Error archiving sentiment:', err instanceof Error ? err.message : err);
  }
}

async function runRetention() {
  try {
    console.log('[DataRetention] Running data retention...');

    const now = new Date();

    // Article retention: 30 days
    const articleCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60_000);

    // Archive sentiment before deleting
    await archiveSentimentAggregates(articleCutoff);

    // Delete cluster articles for old articles
    const oldArticleIds = await prisma.newsArticle.findMany({
      where: { scrapedAt: { lt: articleCutoff } },
      select: { id: true },
    });
    const ids = oldArticleIds.map(a => a.id);

    if (ids.length > 0) {
      // Delete related records first (cascade may handle some, but be explicit)
      await prisma.newsClusterArticle.deleteMany({
        where: { articleId: { in: ids } },
      });
      await prisma.aiAnalysisLog.deleteMany({
        where: { articleId: { in: ids } },
      });
      await prisma.stockRecommendation.deleteMany({
        where: { articleId: { in: ids } },
      });
      // Delete the articles
      const deleted = await prisma.newsArticle.deleteMany({
        where: { scrapedAt: { lt: articleCutoff } },
      });
      console.log(`[DataRetention] Deleted ${deleted.count} articles older than 30 days`);
    }

    // Clean up empty clusters
    await prisma.newsCluster.deleteMany({
      where: {
        articles: { none: {} },
      },
    });

    // ScrapeRun retention: 7 days
    const scrapeRunCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60_000);
    const deletedRuns = await prisma.scrapeRun.deleteMany({
      where: { startedAt: { lt: scrapeRunCutoff } },
    });
    if (deletedRuns.count > 0) {
      console.log(`[DataRetention] Deleted ${deletedRuns.count} scrape runs older than 7 days`);
    }

    console.log('[DataRetention] Retention complete');
  } catch (err) {
    console.error('[DataRetention] Error during retention:', err instanceof Error ? err.message : err);
  }
}

export function startDataRetention() {
  console.log('[DataRetention] Starting data retention (24h interval)');
  runRetention(); // immediate first run
  intervalId = setInterval(runRetention, RETENTION_INTERVAL);
}

export function stopDataRetention() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
