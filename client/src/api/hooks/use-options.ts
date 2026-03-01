import { useQuery } from '@tanstack/react-query';
import { api } from '../client';

export interface OptionsFlow {
  symbol: string;
  type: 'call' | 'put';
  strike: number;
  expiry: string;
  volume: number;
  openInterest: number;
  premium: number;
  impliedVolatility: number;
  unusual: string; // reason
}

export function useOptionsFlow(symbols: string[], minPremium: number = 50000) {
  return useQuery<OptionsFlow[]>({
    queryKey: ['options', symbols.join(','), minPremium],
    queryFn: () => api.get(`/options/flow?symbols=${symbols.join(',')}&minPremium=${minPremium}`),
    enabled: symbols.length > 0,
    refetchInterval: 120_000,
  });
}
