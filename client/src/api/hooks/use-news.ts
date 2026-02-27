import { useQuery } from '@tanstack/react-query';
import { api } from '../client';

interface Category {
  slug: string;
  name: string;
  color: string | null;
  icon: string | null;
}

export interface NewsArticle {
  id: number;
  externalId: string;
  title: string;
  content: string | null;
  summary: string | null;
  url: string;
  imageUrl: string | null;
  publishedAt: string | null;
  scrapedAt: string;
  categorySlug: string | null;
  category: Category | null;
  sentiment: string | null;
  sentimentScore: number | null;
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
  analyzed: boolean;
  recommendations: StockRecommendation[];
}

export interface StockRecommendation {
  id: number;
  articleId: number;
  symbol: string;
  action: string;
  confidence: number;
  reason: string | null;
  createdAt: string;
}

interface NewsResponse {
  articles: NewsArticle[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface NewsFilters {
  page?: number;
  limit?: number;
  category?: string | null;
  search?: string;
  sentiment?: string | null;
}

export function useNews(filters: NewsFilters = {}) {
  const params = new URLSearchParams();
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.category) params.set('category', filters.category);
  if (filters.search) params.set('search', filters.search);
  if (filters.sentiment) params.set('sentiment', filters.sentiment);

  const qs = params.toString();
  const path = `/news${qs ? `?${qs}` : ''}`;

  return useQuery({
    queryKey: ['news', filters],
    queryFn: () => api.get<NewsResponse>(path),
  });
}

export function useNewsById(id: number | null) {
  return useQuery({
    queryKey: ['news', id],
    queryFn: () => api.get<NewsArticle>(`/news/${id}`),
    enabled: id !== null,
  });
}
