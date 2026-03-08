/**
 * Hyperliquid market data tracker.
 * Periodically fetches perp + stock-perp metadata & context from Hyperliquid API,
 * caches in memory, and broadcasts updates via WebSocket.
 */

import { broadcastHyperliquidUpdate } from '../websocket/ws-server.js';

const HL_API = 'https://api.hyperliquid.xyz/info';
const REFRESH_INTERVAL = 10_000; // 10 seconds

let intervalId: ReturnType<typeof setInterval> | null = null;
let isRefreshing = false;

// ── In-memory cache ──

export interface HlAsset {
  symbol: string;       // e.g. "BTC", "xyz:NVDA"
  displayName: string;  // e.g. "BTC", "NVDA"
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

let perpAssets: HlAsset[] = [];
let stockPerpAssets: HlAsset[] = [];
let lastUpdated: number = 0;

// Hyperliquid perps that are commodity/index proxies
const COMMODITY_PERPS = new Set(['PAXG']);

// ── API helpers ──

async function hlPost<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch(HL_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Hyperliquid API error: ${res.status}`);
  return res.json() as Promise<T>;
}

interface HlUniverse {
  universe: Array<{
    name: string;
    szDecimals: number;
    maxLeverage: number;
  }>;
}

interface HlCtx {
  markPx: string;
  prevDayPx: string;
  funding: string;
  openInterest: string;
  dayNtlVlm: string;
  dayBaseVlm?: string;
  premium: string;
  oraclePx: string;
  midPx: string;
}

function parseAssets(
  meta: HlUniverse,
  ctxs: HlCtx[],
  type: HlAsset['type'],
): HlAsset[] {
  const result: HlAsset[] = [];
  for (let i = 0; i < meta.universe.length; i++) {
    const asset = meta.universe[i];
    const ctx = ctxs[i];
    if (!ctx?.markPx) continue;

    const mark = parseFloat(ctx.markPx);
    const prev = parseFloat(ctx.prevDayPx);
    const displayName = asset.name.startsWith('xyz:') ? asset.name.slice(4) : asset.name;

    let assetType = type;
    if (type === 'crypto' && COMMODITY_PERPS.has(asset.name)) {
      assetType = 'commodity';
    }

    result.push({
      symbol: asset.name,
      displayName,
      type: assetType,
      markPx: mark,
      prevDayPx: prev,
      changePercent: prev > 0 ? ((mark - prev) / prev) * 100 : null,
      funding: ctx.funding,
      openInterest: parseFloat(ctx.openInterest),
      dayNtlVlm: parseFloat(ctx.dayNtlVlm),
      dayBaseVlm: parseFloat(ctx.dayBaseVlm || '0'),
      premium: ctx.premium,
      oraclePx: parseFloat(ctx.oraclePx),
      midPx: parseFloat(ctx.midPx),
      maxLeverage: asset.maxLeverage,
      szDecimals: asset.szDecimals,
    });
  }
  return result;
}

// ── Refresh logic ──

async function refresh() {
  if (isRefreshing) return;
  isRefreshing = true;
  try {
    const [perpData, stockData] = await Promise.all([
      hlPost<[HlUniverse, HlCtx[]]>({ type: 'metaAndAssetCtxs' }),
      hlPost<[HlUniverse, HlCtx[]]>({ type: 'metaAndAssetCtxs', dex: 'xyz' }),
    ]);

    perpAssets = parseAssets(perpData[0], perpData[1], 'crypto');
    stockPerpAssets = parseAssets(stockData[0], stockData[1], 'stock-perp');
    lastUpdated = Date.now();

    // Broadcast combined update to all WebSocket clients
    broadcastHyperliquidUpdate({
      perps: perpAssets,
      stockPerps: stockPerpAssets,
      updatedAt: lastUpdated,
    });
  } catch (err: any) {
    console.error('[HLTracker] Error refreshing:', err?.message);
  } finally {
    isRefreshing = false;
  }
}

// ── Public API ──

export function getHlPerps(): HlAsset[] {
  return perpAssets;
}

export function getHlStockPerps(): HlAsset[] {
  return stockPerpAssets;
}

export function getHlAsset(symbol: string): HlAsset | undefined {
  return perpAssets.find(a => a.symbol === symbol)
    || stockPerpAssets.find(a => a.symbol === symbol);
}

export function getHlLastUpdated(): number {
  return lastUpdated;
}

export function startHyperliquidTracker() {
  console.log(`[HLTracker] Starting Hyperliquid tracker (${REFRESH_INTERVAL / 1000}s interval)`);
  refresh();
  intervalId = setInterval(refresh, REFRESH_INTERVAL);
}

export function stopHyperliquidTracker() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
