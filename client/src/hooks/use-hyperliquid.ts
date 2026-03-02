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
  getSpotMeta,
  getStockPerpMetaAndCtxs,
} from '../lib/hyperliquid/api';
import type { AllMids } from '../lib/hyperliquid/types';

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

export function useSpotMeta() {
  return useQuery({
    queryKey: ['hl', 'spotMeta'],
    queryFn: getSpotMeta,
    refetchInterval: SLOW,
  });
}

export function useStockPerps() {
  return useQuery({
    queryKey: ['hl', 'stockPerps'],
    queryFn: getStockPerpMetaAndCtxs,
    refetchInterval: FAST,
  });
}

/** Combined mid prices: regular allMids + stock perp markPx */
export function useCombinedMids(): { data: AllMids | undefined } {
  const { data: mids } = useAllMids();
  const { data: stockPerps } = useStockPerps();

  const data = useMemo(() => {
    if (!mids && !stockPerps) return undefined;
    const combined: AllMids = {};
    if (mids) Object.assign(combined, mids);
    if (stockPerps) {
      const [meta, ctxs] = stockPerps;
      for (let i = 0; i < meta.universe.length; i++) {
        const markPx = ctxs[i]?.markPx;
        if (markPx) combined[meta.universe[i].name] = markPx;
      }
    }
    return combined;
  }, [mids, stockPerps]);

  return { data };
}

export function useHyperliquidAssets(): Set<string> {
  const { data: perpMeta } = useMeta();
  const { data: spotMeta } = useSpotMeta();
  return useMemo(() => {
    const set = new Set<string>();
    if (perpMeta) {
      for (const a of perpMeta.universe) set.add(a.name);
    }
    if (spotMeta) {
      for (const t of spotMeta.tokens) set.add(t.name);
    }
    return set;
  }, [perpMeta, spotMeta]);
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
