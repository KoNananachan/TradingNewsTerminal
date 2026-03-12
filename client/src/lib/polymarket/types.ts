// Gamma API types
export interface PolymarketMarket {
  id: string;
  question: string;
  description: string;
  conditionId: string;
  slug: string;
  endDate: string;
  liquidity: string;
  volume: string;
  volume24hr: string;
  active: boolean;
  closed: boolean;
  image: string;
  icon: string;
  outcomePrices: string; // JSON stringified "[0.65, 0.35]"
  outcomes: string; // JSON stringified '["Yes","No"]'
  clobTokenIds: string; // JSON stringified token IDs array
  tags: string[];
  createdAt: string;
  groupItemTitle?: string;
  orderPriceMinTickSize?: number;
  orderMinSize?: number;
  events?: { slug: string }[];
}

export interface PolymarketEvent {
  id: string;
  title: string;
  slug: string;
  description: string;
  endDate: string;
  liquidity: number;
  volume: number;
  volume24hr: number;
  markets: PolymarketMarket[];
  image: string;
  icon: string;
  active: boolean;
  closed: boolean;
  tags: string[];
  createdAt: string;
}

// CLOB API types
export interface CLOBBookLevel {
  price: string;
  size: string;
}

export interface CLOBBook {
  market: string;
  asset_id: string;
  bids: CLOBBookLevel[];
  asks: CLOBBookLevel[];
  hash: string;
  timestamp: string;
}

export interface CLOBPricePoint {
  t: number; // unix timestamp
  p: number; // price
}

export interface CLOBPosition {
  asset: string;
  conditionId: string;
  size: string;
  avgPrice: string;
  side: string;
  cur_price?: string;
}

// Polymarket contract addresses on Polygon
export const POLYMARKET_CONTRACTS = {
  CTF_EXCHANGE: '0xC5d563A36AE78145C45a50134d48A1215220f80a' as const,
  NEG_RISK_CTF_EXCHANGE: '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E' as const,
  NEG_RISK_ADAPTER: '0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296' as const,
  CONDITIONAL_TOKENS: '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045' as const,
  USDC_E: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' as const,
} as const;

// EIP-712 types for CLOB auth
export const CLOB_AUTH_DOMAIN = {
  name: 'ClobAuthDomain',
  version: '1',
  chainId: 137,
} as const;

export const CLOB_AUTH_TYPES = {
  ClobAuth: [
    { name: 'address', type: 'address' },
    { name: 'timestamp', type: 'string' },
    { name: 'nonce', type: 'uint256' },
    { name: 'message', type: 'string' },
  ],
} as const;

export type MarketCategory = 'all' | 'politics' | 'crypto' | 'sports' | 'science' | 'pop-culture';

// Helper to safely parse JSON arrays from Polymarket API
export function parseJsonArray<T>(json: string | undefined): T[] {
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
}
