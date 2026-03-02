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

interface InsiderTradesResponse {
  trades: InsiderTrade[];
  clusterBuys: Array<{ symbol: string; count: number }>;
}

export function useInsiderTrades(symbols: string[], days: number = 30) {
  return useQuery<InsiderTrade[]>({
    queryKey: ['insiders', symbols.join(','), days],
    queryFn: async () => {
      const resp = await api.get<InsiderTradesResponse>(`/insiders?symbols=${symbols.join(',')}&days=${days}`);
      const clusterSymbols = new Set((resp.clusterBuys || []).map(cb => cb.symbol));
      return (resp.trades || []).map(t => ({
        ...t,
        clusterBuy: clusterSymbols.has(t.symbol),
      }));
    },
    enabled: symbols.length > 0,
    refetchInterval: 300_000,
  });
}
