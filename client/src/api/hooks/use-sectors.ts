import { useQuery } from '@tanstack/react-query';
import { api } from '../client';

export interface SectorPerformance {
  symbol: string;
  name: string;
  return: number;
  currentPrice: number;
}

export interface SectorRotation {
  symbol: string;
  name: string;
  momentum: number;
  acceleration: number;
  quadrant: 'leading' | 'weakening' | 'lagging' | 'improving';
}

export function useSectorPerformance(period: string = '1M') {
  return useQuery<{ sectors: SectorPerformance[] }>({
    queryKey: ['sectors', 'performance', period],
    queryFn: () => api.get(`/sectors/performance?period=${period}`),
    refetchInterval: 300_000, // 5 min
  });
}

export function useSectorRotation() {
  return useQuery<{ sectors: SectorRotation[] }>({
    queryKey: ['sectors', 'rotation'],
    queryFn: () => api.get('/sectors/rotation'),
    refetchInterval: 300_000,
  });
}
