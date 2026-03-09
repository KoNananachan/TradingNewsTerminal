import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type {
  PolymarketMarket,
  PolymarketEvent,
  CLOBBook,
  CLOBPricePoint,
  CLOBPosition,
} from '../lib/polymarket/types';

// ---------------------------------------------------------------------------
// Gamma API hooks
// ---------------------------------------------------------------------------

export function usePolymarketMarkets(options?: {
  limit?: number;
  offset?: number;
  tag?: string;
}) {
  return useQuery({
    queryKey: ['polymarket-markets', options],
    queryFn: () => {
      const params = new URLSearchParams();
      if (options?.limit) params.set('limit', String(options.limit));
      if (options?.offset) params.set('offset', String(options.offset));
      if (options?.tag && options.tag !== 'all') params.set('tag', options.tag);
      const qs = params.toString();
      return api.get<PolymarketMarket[]>(`/polymarket/markets${qs ? `?${qs}` : ''}`);
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

export function usePolymarketEvents(options?: {
  limit?: number;
  offset?: number;
  tag?: string;
}) {
  return useQuery({
    queryKey: ['polymarket-events', options],
    queryFn: () => {
      const params = new URLSearchParams();
      if (options?.limit) params.set('limit', String(options.limit));
      if (options?.offset) params.set('offset', String(options.offset));
      if (options?.tag && options.tag !== 'all') params.set('tag', options.tag);
      const qs = params.toString();
      return api.get<PolymarketEvent[]>(`/polymarket/events${qs ? `?${qs}` : ''}`);
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

export function usePolymarketMarket(id: string | null) {
  return useQuery({
    queryKey: ['polymarket-market', id],
    queryFn: () => api.get<PolymarketMarket>(`/polymarket/markets/${id}`),
    enabled: !!id,
    staleTime: 15_000,
  });
}

// ---------------------------------------------------------------------------
// CLOB API hooks
// ---------------------------------------------------------------------------

export function useCLOBBook(tokenId: string | null) {
  return useQuery({
    queryKey: ['clob-book', tokenId],
    queryFn: () =>
      api.get<CLOBBook>(`/polymarket/clob/book?token_id=${encodeURIComponent(tokenId!)}`),
    enabled: !!tokenId,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}

export function useCLOBMidpoint(tokenId: string | null) {
  return useQuery({
    queryKey: ['clob-midpoint', tokenId],
    queryFn: () =>
      api.get<{ mid: string }>(`/polymarket/clob/midpoint?token_id=${encodeURIComponent(tokenId!)}`),
    enabled: !!tokenId,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}

export function useCLOBPriceHistory(
  conditionId: string | null,
  interval: string = 'max',
) {
  return useQuery({
    queryKey: ['clob-price-history', conditionId, interval],
    queryFn: async () => {
      const resp = await api.get<{ history: CLOBPricePoint[] } | CLOBPricePoint[]>(
        `/polymarket/clob/prices-history?market=${encodeURIComponent(conditionId!)}&interval=${encodeURIComponent(interval)}&fidelity=60`,
      );
      // CLOB API returns { history: [...] }
      if (resp && typeof resp === 'object' && 'history' in resp) return resp.history;
      if (Array.isArray(resp)) return resp;
      return [];
    },
    enabled: !!conditionId,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

export function useCLOBPositions(
  address: string | null,
  conditionId: string | null,
) {
  return useQuery({
    queryKey: ['clob-positions', address, conditionId],
    queryFn: () =>
      api.get<CLOBPosition[]>(
        `/polymarket/clob/data/position?user=${encodeURIComponent(address!)}&market=${encodeURIComponent(conditionId!)}`,
      ),
    enabled: !!address && !!conditionId,
    staleTime: 15_000,
    refetchInterval: 15_000,
  });
}
