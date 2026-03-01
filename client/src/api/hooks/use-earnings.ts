import { useQuery } from '@tanstack/react-query';
import { api } from '../client';

export interface EarningsEntry {
  symbol: string;
  name: string | null;
  earningsDate: string | null;
  epsEstimate: number | null;
  epsActual: number | null;
  revenueEstimate: number | null;
}

export function useEarningsCalendar(days: number = 14) {
  return useQuery<EarningsEntry[]>({
    queryKey: ['earnings', days],
    queryFn: () => api.get(`/stocks/earnings-calendar?days=${days}`),
    refetchInterval: 300_000,
  });
}
