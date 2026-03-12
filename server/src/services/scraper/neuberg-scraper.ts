/**
 * News scraper — fetches articles from the configured news API and stores them.
 *
 * The news API URL is configured via the NEWS_API_URL env var.
 * If not set, scraping is skipped (the app works fine without a news source —
 * it just won't receive new articles).
 *
 * The default implementation expects the Neuberg API response format.
 * To use a different news source, either:
 *   1. Set up an adapter proxy that converts your source to this format, or
 *   2. Implement the NewsSource interface (see news-source.ts) and register it
 *      in scraper-scheduler.ts.
 */

import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import type { NewsSource, NewsItem, NewsItemAsset } from './news-source.js';

const FETCH_LIMIT = 100;

// ── Neuberg API response types ──

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
  category: string;
  assets: ApiAsset[];
  raw_news: ApiRawNews;
}

// ── Neuberg API adapter (implements NewsSource) ──

function longShortToAction(ls: string): 'BUY' | 'SELL' | 'HOLD' {
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

export class NeubergSource implements NewsSource {
  name = 'neuberg';
  private apiUrl: string;

  constructor(apiUrl: string) {
    this.apiUrl = apiUrl;
  }

  async fetchArticles(limit: number): Promise<NewsItem[]> {
    const resp = await fetch(`${this.apiUrl}?limit=${limit}`, {
      headers: { 'User-Agent': 'Neuberg/1.0' },
      signal: AbortSignal.timeout(15_000),
    });

    if (!resp.ok) {
      throw new Error(`News API returned ${resp.status}`);
    }

    const items: ApiItem[] = await resp.json() as ApiItem[];
    return items.map((item) => this.normalize(item));
  }

  private normalize(item: ApiItem): NewsItem {
    const news = item.raw_news;
    const content = item.assets
      .map((a) => `[${a.long_short.toUpperCase()}] ${a.code} (${a.name}): ${a.reason}`)
      .join('\n\n');

    const publishedAt = news.data_time
      ? new Date(news.data_time * 1000)
      : new Date(item.analyzed_at);

    const assets: NewsItemAsset[] = item.assets
      .filter((a) => !!a.code)
      .map((a) => ({
        symbol: a.code,
        action: longShortToAction(a.long_short),
        confidence: longShortToConfidence(a.long_short, a.impact),
        reason: a.reason,
      }));

    return {
      externalId: item.id,
      title: news.title,
      content: content || null,
      url: news.origin_url || null,
      publishedAt,
      isBreaking: item.is_breaking,
      category: item.category || undefined,
      assets,
    };
  }
}

// Known API categories (must match seed data)
const KNOWN_CATEGORIES = new Set(['finance', 'world', 'business', 'politics']);

// ── Scraper engine (source-agnostic) ──

const MAX_KNOWN_IDS = 50_000;
let knownIds = new Set<string>();
let cacheLoaded = false;

async function loadKnownIds() {
  if (cacheLoaded) return;
  const rows = await prisma.newsArticle.findMany({
    select: { externalId: true },
    orderBy: { id: 'desc' },
    take: MAX_KNOWN_IDS,
  });
  for (const r of rows) knownIds.add(r.externalId);
  cacheLoaded = true;
  console.log(`[Scraper] Loaded ${knownIds.size} known article IDs into cache`);
}

/** Create the configured news source, or null if not configured */
export function createNewsSource(): NewsSource | null {
  const url = env.NEWS_API_URL;
  if (!url) {
    console.warn('[Scraper] NEWS_API_URL not configured — scraping disabled');
    return null;
  }
  return new NeubergSource(url);
}

export async function scrapeArticles(source?: NewsSource | null): Promise<number> {
  if (!source) {
    source = createNewsSource();
    if (!source) return 0;
  }

  console.log(`[Scraper] Fetching from ${source.name}...`);
  await loadKnownIds();

  const startTime = Date.now();
  const run = await prisma.scrapeRun.create({ data: { status: 'running' } });
  let itemsFetched = 0;
  let itemsNew = 0;
  let itemsSkipped = 0;
  let itemsFailed = 0;

  try {
    const items = await source.fetchArticles(FETCH_LIMIT);
    itemsFetched = items.length;
    console.log(`[Scraper] Got ${items.length} items from ${source.name}`);

    // Filter new items
    const newItems = items.filter((item) => !knownIds.has(item.externalId));
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
        const created = await prisma.newsArticle.create({
          data: {
            externalId: item.externalId,
            title: item.title,
            content: item.content,
            url: item.url || '',
            imageUrl: null,
            publishedAt: item.publishedAt,
            categorySlug: item.category && KNOWN_CATEGORIES.has(item.category) ? item.category : null,
          },
        });

        // Create stock recommendations from assets
        for (const asset of item.assets) {
          try {
            await prisma.stockRecommendation.create({
              data: {
                articleId: created.id,
                symbol: asset.symbol,
                action: asset.action,
                confidence: asset.confidence,
                reason: asset.reason,
                articleTitle: item.title,
                publishedAt: item.publishedAt,
              },
            });
          } catch {
            // skip duplicates
          }
        }

        knownIds.add(item.externalId);
        itemsNew++;
        const flag = item.isBreaking ? ' [BREAKING]' : '';
        console.log(`[Scraper] New${flag}: "${item.title.slice(0, 60)}" (${item.assets.length} assets)`);
      } catch (err: any) {
        if (err?.code === 'P2002') {
          knownIds.add(item.externalId);
          itemsSkipped++;
        } else {
          itemsFailed++;
          console.error(`[Scraper] Error inserting: ${item.title.slice(0, 50)}`, err);
        }
      }
    }

    // Evict oldest entries if cache exceeds max size
    if (knownIds.size > MAX_KNOWN_IDS) {
      const arr = Array.from(knownIds);
      knownIds = new Set(arr.slice(arr.length - MAX_KNOWN_IDS));
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
