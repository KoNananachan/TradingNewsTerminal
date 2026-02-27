import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api } from '../client';
import type { StockQuote } from './use-stocks';

export interface WatchlistItem {
  symbol: string;
  name: string | null;
  source: string;
  quote: StockQuote | null;
}

export function useWatchlist() {
  return useQuery({
    queryKey: ['watchlist'],
    queryFn: () => api.get<WatchlistItem[]>('/watchlist'),
    refetchInterval: 10_000,
  });
}

export function useAddToWatchlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (symbol: string) => api.post('/watchlist', { symbol }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['watchlist'] });
      qc.invalidateQueries({ queryKey: ['stocks'] });
    },
  });
}

export interface TickerSuggestion {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
}

export function useTickerSearch(query: string) {
  return useQuery({
    queryKey: ['ticker-search', query],
    queryFn: () => api.get<TickerSuggestion[]>(`/watchlist/search?q=${encodeURIComponent(query)}`),
    enabled: query.length >= 1,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useRemoveFromWatchlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (symbol: string) => api.delete(`/watchlist/${symbol}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['watchlist'] });
      qc.invalidateQueries({ queryKey: ['stocks'] });
    },
  });
}
