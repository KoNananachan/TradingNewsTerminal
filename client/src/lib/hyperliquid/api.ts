// Hyperliquid REST API client
import type {
  AllMids,
  AssetCtx,
  L2Book,
  UserState,
  UserFill,
  OpenOrder,
  SpotUserState,
  FundingRate,
  Universe,
  SpotMeta,
} from './types';

const BASE_URL = 'https://api.hyperliquid.xyz';

async function postInfo<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE_URL}/info`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Hyperliquid API error: ${res.status}`);
  return res.json() as Promise<T>;
}

// -- Market Data --

export function getAllMids(): Promise<AllMids> {
  return postInfo({ type: 'allMids' });
}

export function getL2Book(coin: string, nSigFigs?: number): Promise<L2Book> {
  return postInfo({ type: 'l2Book', coin, ...(nSigFigs ? { nSigFigs } : {}) });
}

export function getMeta(): Promise<Universe> {
  return postInfo({ type: 'meta' });
}

export function getSpotMeta(): Promise<SpotMeta> {
  return postInfo({ type: 'spotMeta' });
}

export function getStockPerpMetaAndCtxs(): Promise<[Universe, AssetCtx[]]> {
  return postInfo({ type: 'metaAndAssetCtxs', dex: 'xyz' });
}

export function getFundingRates(coin: string, startTime: number, endTime?: number): Promise<FundingRate[]> {
  return postInfo({
    type: 'fundingHistory',
    coin,
    startTime,
    ...(endTime ? { endTime } : {}),
  });
}

// -- User Data (requires wallet address) --

export function getUserState(user: string): Promise<UserState> {
  return postInfo({ type: 'clearinghouseState', user });
}

export function getSpotBalances(user: string): Promise<SpotUserState> {
  return postInfo({ type: 'spotClearinghouseState', user });
}

export function getUserFills(user: string): Promise<UserFill[]> {
  return postInfo({ type: 'userFills', user });
}

export function getOpenOrders(user: string): Promise<OpenOrder[]> {
  return postInfo({ type: 'openOrders', user });
}

// -- Exchange actions (requires signing) --

export async function postExchange(body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${BASE_URL}/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Hyperliquid exchange error: ${res.status} ${text}`);
  }
  return res.json();
}
