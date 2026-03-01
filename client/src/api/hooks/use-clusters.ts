import { useQuery } from '@tanstack/react-query';
import { api } from '../client';

export interface NewsCluster {
  id: number;
  title: string;
  summary: string | null;
  impactScore: number;
  category: string | null;
  tickers: string[];
  articleCount: number;
  avgSentiment: number | null;
  articles: Array<{
    id: number;
    title: string;
    url: string;
    scrapedAt: string;
    sentiment: string | null;
    sentimentScore: number | null;
  }>;
  createdAt: string;
}

export function useNewsClusters(limit: number = 20, minImpact: number = 0) {
  return useQuery<NewsCluster[]>({
    queryKey: ['clusters', limit, minImpact],
    queryFn: () => api.get(`/clusters?limit=${limit}&minImpact=${minImpact}`),
    refetchInterval: 120_000,
  });
}
