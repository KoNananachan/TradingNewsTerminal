import { useQuery } from '@tanstack/react-query';
import { api } from '../client';

export interface InsiderTrade {
  id: number;
  symbol: string;
  filingDate: string;
  tradeDate: string;
  ownerName: string;
  ownerTitle: string | null;
  transactionType: string;
  shares: number;
  pricePerShare: number | null;
  totalValue: number | null;
  sharesOwned: number | null;
  clusterBuy?: boolean;
}

export function useInsiderTrades(symbols: string[], days: number = 30) {
  return useQuery<InsiderTrade[]>({
    queryKey: ['insiders', symbols.join(','), days],
    queryFn: () => api.get(`/insiders?symbols=${symbols.join(',')}&days=${days}`),
    enabled: symbols.length > 0,
    refetchInterval: 300_000,
  });
}
