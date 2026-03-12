import { useQuery } from '@tanstack/react-query';
import { api } from '../client';

export interface MissedOpportunity {
  symbol: string;
  action: string;
  confidence: number;
  reason: string | null;
  reasonTranslations: string | null;
  articleTitle: string;
  titleTranslations: string | null;
  articleId: number | null;
  publishedAt: string;
  priceAtNews: number;
  return1d: number | null;
  return3d: number | null;
  return5d: number | null;
  bestReturn: number;
}

export function useMissedOpportunities() {
  return useQuery({
    queryKey: ['missed-opportunities'],
    queryFn: () => api.get<MissedOpportunity[]>('/missed-opportunities'),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchInterval: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
  });
}
