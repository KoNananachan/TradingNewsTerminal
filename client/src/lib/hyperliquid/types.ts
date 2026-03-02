// Hyperliquid API type definitions

export interface AssetMeta {
  name: string;
  szDecimals: number;
  maxLeverage: number;
  onlyIsolated: boolean;
}

export interface Universe {
  universe: AssetMeta[];
}

export interface AllMids {
  [coin: string]: string; // coin -> mid price
}

export interface SpotMeta {
  universe: SpotAssetMeta[];
  tokens: SpotToken[];
}

export interface SpotAssetMeta {
  name: string;
  tokens: [number, number]; // [base token index, quote token index]
  index: number;
  isCanonical: boolean;
}

export interface SpotToken {
  name: string;
  szDecimals: number;
  weiDecimals: number;
  index: number;
  tokenId: string;
  isNative: boolean;
}

export interface L2Book {
  coin: string;
  levels: [L2Level[], L2Level[]]; // [bids, asks]
  time: number;
}

export interface L2Level {
  px: string; // price
  sz: string; // size
  n: number;  // number of orders
}

export interface UserState {
  assetPositions: AssetPosition[];
  crossMarginSummary: MarginSummary;
  marginSummary: MarginSummary;
  withdrawable: string;
}

export interface AssetPosition {
  position: Position;
  type: 'oneWay';
}

export interface Position {
  coin: string;
  entryPx: string | null;
  leverage: { type: string; value: number };
  liquidationPx: string | null;
  marginUsed: string;
  positionValue: string;
  returnOnEquity: string;
  szi: string; // signed size (negative = short)
  unrealizedPnl: string;
}

export interface MarginSummary {
  accountValue: string;
  totalMarginUsed: string;
  totalNtlPos: string;
  totalRawUsd: string;
}

export interface UserFill {
  coin: string;
  px: string;
  sz: string;
  side: 'B' | 'A'; // Buy | Ask(Sell)
  time: number;
  startPosition: string;
  dir: string;
  closedPnl: string;
  hash: string;
  oid: number;
  crossed: boolean;
  fee: string;
  tid: number;
  feeToken: string;
}

export interface SpotBalance {
  coin: string;
  token: number;
  hold: string;
  total: string;
  entryNtl: string;
}

export interface SpotUserState {
  balances: SpotBalance[];
}

export interface AssetCtx {
  markPx: string;
  funding: string;
  openInterest: string;
  dayNtlVlm: string;
  prevDayPx: string;
  impactPxs: [string, string];
}

export interface FundingRate {
  coin: string;
  fundingRate: string;
  premium: string;
  time: number;
}

export interface OrderRequest {
  coin: string;
  is_buy: boolean;
  sz: number;
  limit_px: number;
  order_type: { limit: { tif: 'Gtc' | 'Ioc' | 'Alo' } } | { trigger: { triggerPx: number; isMarket: boolean; tpsl: 'tp' | 'sl' } };
  reduce_only: boolean;
}

export interface CancelRequest {
  coin: string;
  oid: number;
}

export interface OpenOrder {
  coin: string;
  limitPx: string;
  oid: number;
  side: 'B' | 'A';
  sz: string;
  timestamp: number;
}
