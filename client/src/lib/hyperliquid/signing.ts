/**
 * Hyperliquid EIP-712 signing utilities for L1 actions (orders, cancels).
 * Based on the official Python SDK signing implementation.
 */
import { encode } from '@msgpack/msgpack';
import { keccak256, type Hex } from 'viem';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

// EIP-712 domain for L1 actions — chainId is 1337 (Hyperliquid L1), NOT Arbitrum
export const ORDER_DOMAIN = {
  name: 'Exchange',
  version: '1',
  chainId: 1337,
  verifyingContract: ZERO_ADDRESS,
} as const;

export const AGENT_TYPES = {
  Agent: [
    { name: 'source', type: 'string' },
    { name: 'connectionId', type: 'bytes32' },
  ],
} as const;

// EIP-712 domain for user-signed actions (transfers, withdrawals, agent approval)
// chainId 421614 (0x66eee) — matches the Hyperliquid Python SDK
export const USER_SIGN_DOMAIN = {
  name: 'HyperliquidSignTransaction',
  version: '1',
  chainId: 421614,
  verifyingContract: ZERO_ADDRESS,
} as const;

export const USER_SIGN_CHAIN_ID = '0x66eee' as const;

export const USD_TRANSFER_TYPES = {
  'HyperliquidTransaction:UsdClassTransfer': [
    { name: 'hyperliquidChain', type: 'string' },
    { name: 'amount', type: 'string' },
    { name: 'toPerp', type: 'bool' },
    { name: 'nonce', type: 'uint64' },
  ],
} as const;

export interface OrderWire {
  a: number;
  b: boolean;
  p: string;
  s: string;
  r: boolean;
  t: { limit: { tif: 'Gtc' | 'Ioc' | 'Alo' } };
}

/**
 * Remove trailing zeros from a decimal string.
 * e.g., "0.010" → "0.01", "1.00" → "1", "100" → "100"
 */
function removeTrailingZeros(value: string): string {
  if (!value.includes('.')) return value;
  const normalized = value.replace(/\.?0+$/, '');
  if (normalized === '-0') return '0';
  return normalized;
}

/**
 * Recursively normalize trailing zeros in price (p) and size (s) fields.
 * The Hyperliquid server normalizes these before computing the action hash.
 */
function normalizeTrailingZeros<T>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(normalizeTrailingZeros) as unknown as T;
  const result = { ...obj };
  for (const key in result) {
    if (!Object.prototype.hasOwnProperty.call(result, key)) continue;
    const value = (result as Record<string, unknown>)[key];
    if (value && typeof value === 'object') {
      (result as Record<string, unknown>)[key] = normalizeTrailingZeros(value);
    } else if ((key === 'p' || key === 's') && typeof value === 'string') {
      (result as Record<string, unknown>)[key] = removeTrailingZeros(value);
    }
  }
  return result;
}

/**
 * Compute the action hash for L1 action signing.
 * Format: msgpack(action) + nonce(8 bytes big-endian) + vault_flag(1 byte) [+ vault_address(20 bytes)]
 * The server normalizes trailing zeros in price/size fields before hashing,
 * so we must do the same (matching the nomeida/hyperliquid JS SDK).
 */
export function computeActionHash(
  action: Record<string, unknown>,
  nonce: number,
  vaultAddress?: string,
): Hex {
  const msgpackBytes = encode(normalizeTrailingZeros(action));

  // Build the data buffer: msgpack + nonce(8 bytes BE) + vault flag
  const nonceBuf = new Uint8Array(8);
  const view = new DataView(nonceBuf.buffer);
  // Write nonce as 8-byte big-endian
  view.setUint32(0, Math.floor(nonce / 0x100000000));
  view.setUint32(4, nonce >>> 0);

  let data: Uint8Array;
  if (!vaultAddress) {
    // No vault: append 0x00
    data = new Uint8Array(msgpackBytes.length + 8 + 1);
    data.set(new Uint8Array(msgpackBytes), 0);
    data.set(nonceBuf, msgpackBytes.length);
    data[msgpackBytes.length + 8] = 0x00;
  } else {
    // Has vault: append 0x01 + 20-byte address
    const addrHex = vaultAddress.startsWith('0x') ? vaultAddress.slice(2) : vaultAddress;
    const addrBytes = hexToBytes(addrHex);
    data = new Uint8Array(msgpackBytes.length + 8 + 1 + 20);
    data.set(new Uint8Array(msgpackBytes), 0);
    data.set(nonceBuf, msgpackBytes.length);
    data[msgpackBytes.length + 8] = 0x01;
    data.set(addrBytes, msgpackBytes.length + 8 + 1);
  }

  return keccak256(data);
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

const MAX_SIG_FIGS = 5;

/**
 * Round price to at most 5 significant figures (Hyperliquid requirement).
 */
export function formatPrice(price: number): string {
  const rounded = parseFloat(price.toPrecision(MAX_SIG_FIGS));
  return String(rounded);
}

/**
 * Format size with proper decimal precision.
 */
export function formatSize(size: number, szDecimals: number): string {
  return size.toFixed(szDecimals);
}

/**
 * Build an order action object for signing.
 */
export function buildOrderAction(orders: OrderWire[], grouping = 'na') {
  return {
    type: 'order' as const,
    orders,
    grouping,
  };
}

/**
 * Apply slippage to mid price for market orders.
 * Default 5% slippage (matching Hyperliquid SDK default).
 */
export function applySlippage(
  midPrice: number,
  isBuy: boolean,
  slippage = 0.05,
): number {
  return isBuy ? midPrice * (1 + slippage) : midPrice * (1 - slippage);
}

/**
 * Resolve the global asset index for a coin.
 * - Regular perps: offset 0
 * - Spot: offset 10000
 * - Builder dexes (xyz, flx, etc.): offset from perpDexs API
 */
export interface AssetIndexInfo {
  globalIndex: number;
  szDecimals: number;
  isBuilderDex: boolean;
}

// Dex name → global offset mapping (computed from perpDexs API)
let dexOffsets: Record<string, number> | null = null;
let dexOffsetsPromise: Promise<Record<string, number>> | null = null;

export async function getDexOffsets(): Promise<Record<string, number>> {
  if (dexOffsets) return dexOffsets;
  if (dexOffsetsPromise) return dexOffsetsPromise;

  dexOffsetsPromise = (async () => {
    const res = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'perpDexs' }),
    });
    const data = await res.json();
    const offsets: Record<string, number> = { '': 0 };
    for (let i = 1; i < data.length; i++) {
      if (data[i]?.name) {
        offsets[data[i].name] = 110000 + (i - 1) * 10000;
      }
    }
    dexOffsets = offsets;
    return offsets;
  })();

  return dexOffsetsPromise;
}

/**
 * Get the dex prefix from a coin name (e.g., "xyz" from "xyz:NVDA", "" from "BTC")
 */
export function getDexPrefix(coin: string): string {
  return coin.includes(':') ? coin.split(':')[0] : '';
}
