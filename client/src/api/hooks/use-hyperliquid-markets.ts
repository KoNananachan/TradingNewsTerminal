import { useQuery } from '@tanstack/react-query';
import { api } from '../client';

export interface HlAsset {
  symbol: string;
  displayName: string;
  type: 'crypto' | 'stock-perp' | 'commodity';
  markPx: number;
  prevDayPx: number;
  changePercent: number | null;
  funding: string;
  openInterest: number;
  dayNtlVlm: number;
  dayBaseVlm: number;
  premium: string;
  oraclePx: number;
  midPx: number;
  maxLeverage: number;
  szDecimals: number;
}

interface HlMarketsResponse {
  perps: HlAsset[];
  stockPerps: HlAsset[];
  updatedAt: number;
}

export function useHlMarkets() {
  return useQuery({
    queryKey: ['hl', 'markets'],
    queryFn: () => api.get<HlMarketsResponse>('/hyperliquid/markets'),
    refetchInterval: 15_000, // 15s — server refreshes every 10s
  });
}

export function useHlAssetDetail(symbol: string | null) {
  return useQuery({
    queryKey: ['hl', 'asset', symbol],
    queryFn: () => api.get<HlAsset>(`/hyperliquid/asset/${encodeURIComponent(symbol!)}`),
    enabled: !!symbol,
    refetchInterval: 15_000,
  });
}
