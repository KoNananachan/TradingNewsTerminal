import { prisma } from '../../lib/prisma.js';

const API_URL = 'https://tradingnews.press/api/v1/analysis/snapshot';
const FETCH_LIMIT = 100;

interface ApiAsset {
  type: string;
  name: string;
  code: string;
  long_short: string;   // long / short / neutral
  reason: string;
  impact: string;        // "Primary Impact" / "Secondary Impact"
}

interface ApiRawNews {
  source_record_id: string;
  title: string;
  content: string | null;
  origin_url: string | null;
  data_time: number;
}

interface ApiItem {
  id: string;
  analyzed_at: string;
  is_breaking: boolean;
  breaking_reason: string;
  assets: ApiAsset[];
  raw_news: ApiRawNews;
}

// In-memory cache of known external IDs
const knownIds = new Set<string>();
let cacheLoaded = false;

async function loadKnownIds() {
  if (cacheLoaded) return;
  const rows = await prisma.newsArticle.findMany({ select: { externalId: true } });
  for (const r of rows) knownIds.add(r.externalId);
  cacheLoaded = true;
  console.log(`[Scraper] Loaded ${knownIds.size} known article IDs into cache`);
}

function longShortToAction(ls: string): string {
  switch (ls) {
    case 'long': return 'BUY';
    case 'short': return 'SELL';
    default: return 'HOLD';
  }
}

function longShortToConfidence(ls: string, impact: string): number {
  const primary = impact === 'Primary Impact';
  switch (ls) {
    case 'long': return primary ? 0.8 : 0.6;
    case 'short': return primary ? 0.7 : 0.55;
    default: return primary ? 0.5 : 0.4;
  }
}

export async function scrapeArticles(): Promise<number> {
  console.log('[Scraper] Fetching from API...');
  await loadKnownIds();

  const startTime = Date.now();
  const run = await prisma.scrapeRun.create({ data: { status: 'running' } });
  let itemsFetched = 0;
  let itemsNew = 0;
  let itemsSkipped = 0;
  let itemsFailed = 0;

  try {
    const resp = await fetch(`${API_URL}?limit=${FETCH_LIMIT}`, {
      headers: { 'User-Agent': 'TradingNewsWeb/1.0' },
      signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok) {
      console.error(`[Scraper] API returned ${resp.status}`);
      await prisma.scrapeRun.update({
        where: { id: run.id },
        data: { status: 'error', errorMessage: `API returned ${resp.status}`, finishedAt: new Date(), durationMs: Date.now() - startTime },
      });
      return 0;
    }

    const items: ApiItem[] = await resp.json() as ApiItem[];
    itemsFetched = items.length;
    console.log(`[Scraper] Got ${items.length} items from API`);

    // Filter new items
    const newItems = items.filter((item) => !knownIds.has(item.id));
    itemsSkipped = items.length - newItems.length;

    if (newItems.length === 0) {
      console.log('[Scraper] No new articles.');
      await prisma.scrapeRun.update({
        where: { id: run.id },
        data: { status: 'success', itemsFetched, itemsSkipped, finishedAt: new Date(), durationMs: Date.now() - startTime },
      });
      return 0;
    }

    for (const item of newItems) {
      try {
        const news = item.raw_news;

        // Build content from all asset analyses
        const content = item.assets
          .map((a) => `[${a.long_short.toUpperCase()}] ${a.code} (${a.name}): ${a.reason}`)
          .join('\n\n');

        const publishedAt = news.data_time
          ? new Date(news.data_time * 1000)
          : new Date(item.analyzed_at);

        const created = await prisma.newsArticle.create({
          data: {
            externalId: item.id,
            title: news.title,
            content: content || null,
            url: news.origin_url || `https://tradingnews.press`,
            imageUrl: null,
            publishedAt,
          },
        });

        // Create stock recommendations from assets
        for (const asset of item.assets) {
          if (!asset.code) continue;
          try {
            await prisma.stockRecommendation.create({
              data: {
                articleId: created.id,
                symbol: asset.code,
                action: longShortToAction(asset.long_short),
                confidence: longShortToConfidence(asset.long_short, asset.impact),
                reason: asset.reason,
              },
            });
          } catch {
            // skip duplicates
          }
        }

        knownIds.add(item.id);
        itemsNew++;
        const flag = item.is_breaking ? ' [BREAKING]' : '';
        console.log(`[Scraper] New${flag}: "${news.title.slice(0, 60)}" (${item.assets.length} assets)`);
      } catch (err: any) {
        if (err?.code === 'P2002') {
          knownIds.add(item.id);
          itemsSkipped++;
        } else {
          itemsFailed++;
          console.error(`[Scraper] Error inserting: ${item.raw_news.title.slice(0, 50)}`, err);
        }
      }
    }

    console.log(`[Scraper] Done. ${itemsNew} new articles.`);
    await prisma.scrapeRun.update({
      where: { id: run.id },
      data: { status: 'success', itemsFetched, itemsNew, itemsSkipped, itemsFailed, finishedAt: new Date(), durationMs: Date.now() - startTime },
    });
    return itemsNew;
  } catch (err) {
    console.error('[Scraper] Error:', err);
    await prisma.scrapeRun.update({
      where: { id: run.id },
      data: { status: 'error', itemsFetched, itemsNew, itemsSkipped, itemsFailed, errorMessage: String(err), finishedAt: new Date(), durationMs: Date.now() - startTime },
    }).catch(() => {});
    return 0;
  }
}
