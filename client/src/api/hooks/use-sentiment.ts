import { useQuery } from '@tanstack/react-query';
import { api } from '../client';

interface SentimentBucket {
  time: string;
  avgScore: number;
  count: number;
}

interface SentimentTrend {
  buckets: SentimentBucket[];
  reversal: boolean;
}

export function useSentimentTrend(scope: string, value: string, window: string) {
  return useQuery<SentimentTrend>({
    queryKey: ['sentiment', scope, value, window],
    queryFn: () =>
      api.get(`/sentiment/trend?scope=${scope}&value=${encodeURIComponent(value)}&window=${window}`),
    enabled: !!value,
    refetchInterval: 60_000,
  });
}
