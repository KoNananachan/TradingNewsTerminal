import { useQuery } from '@tanstack/react-query';
import { api } from '../client';

export interface CorrelationData {
  symbols: string[];
  names: string[];
  matrix: number[][];
}

export function useCorrelationMatrix(period: string = '3M') {
  return useQuery<CorrelationData>({
    queryKey: ['correlations', period],
    queryFn: () => api.get(`/correlations?period=${period}`),
    refetchInterval: 600_000, // 10 min
  });
}
