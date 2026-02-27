import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAccount } from 'wagmi';
import {
  getAllMids,
  getL2Book,
  getUserState,
  getUserFills,
  getOpenOrders,
  getSpotBalances,
  getMeta,
} from '../lib/hyperliquid/api';

// Refresh intervals
const FAST = 3_000;   // prices, orderbook
const MEDIUM = 10_000; // user state
const SLOW = 30_000;   // fills, meta

export function useAllMids() {
  return useQuery({
    queryKey: ['hl', 'allMids'],
    queryFn: getAllMids,
    refetchInterval: FAST,
  });
}

export function useL2Book(coin: string | null) {
  return useQuery({
    queryKey: ['hl', 'l2Book', coin],
    queryFn: () => getL2Book(coin!, 5),
    enabled: !!coin,
    refetchInterval: FAST,
  });
}

export function useMeta() {
  return useQuery({
    queryKey: ['hl', 'meta'],
    queryFn: getMeta,
    refetchInterval: SLOW,
  });
}

export function useHyperliquidAssets(): Set<string> {
  const { data } = useMeta();
  return useMemo(() => new Set(data?.universe.map(a => a.name) ?? []), [data]);
}

export function useUserState() {
  const { address } = useAccount();
  return useQuery({
    queryKey: ['hl', 'userState', address],
    queryFn: () => getUserState(address!),
    enabled: !!address,
    refetchInterval: MEDIUM,
  });
}

export function useSpotBalances() {
  const { address } = useAccount();
  return useQuery({
    queryKey: ['hl', 'spotBalances', address],
    queryFn: () => getSpotBalances(address!),
    enabled: !!address,
    refetchInterval: MEDIUM,
  });
}

export function useUserFills() {
  const { address } = useAccount();
  return useQuery({
    queryKey: ['hl', 'userFills', address],
    queryFn: () => getUserFills(address!),
    enabled: !!address,
    refetchInterval: SLOW,
  });
}

export function useOpenOrders() {
  const { address } = useAccount();
  return useQuery({
    queryKey: ['hl', 'openOrders', address],
    queryFn: () => getOpenOrders(address!),
    enabled: !!address,
    refetchInterval: MEDIUM,
  });
}
