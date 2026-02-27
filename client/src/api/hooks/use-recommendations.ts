import { useQuery } from '@tanstack/react-query';
import { api } from '../client';

export interface Recommendation {
  id: number;
  articleId: number;
  symbol: string;
  action: string;
  confidence: number;
  reason: string | null;
  createdAt: string;
  article: {
    id: number;
    title: string;
    sentiment: string | null;
    sentimentScore: number | null;
    scrapedAt: string;
  };
}

export function useRecommendations(limit = 20) {
  return useQuery({
    queryKey: ['recommendations', limit],
    queryFn: () => api.get<Recommendation[]>(`/recommendations?limit=${limit}`),
  });
}
