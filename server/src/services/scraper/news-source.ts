/**
 * News source adapter interface.
 *
 * Implement this interface to add a new news data source.
 * The scraper scheduler will call fetchArticles() at the configured interval.
 */

export interface NewsItem {
  externalId: string;
  title: string;
  content: string | null;
  url: string | null;
  publishedAt: Date;
  isBreaking?: boolean;
  assets: NewsItemAsset[];
}

export interface NewsItemAsset {
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reason: string;
}

export interface NewsSource {
  /** Display name for logging */
  name: string;

  /**
   * Fetch the latest articles from this source.
   * Should return normalized NewsItem objects.
   * @param limit Maximum number of articles to fetch
   */
  fetchArticles(limit: number): Promise<NewsItem[]>;
}
