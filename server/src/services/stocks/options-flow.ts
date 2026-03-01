import { ensureCrumb } from './yahoo-finance.js';

const YAHOO_API = 'https://query1.finance.yahoo.com';
const YAHOO_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

export interface UnusualOption {
  symbol: string;
  type: 'call' | 'put';
  strike: number;
  expiry: string;
  volume: number;
  openInterest: number;
  premium: number;
  impliedVolatility: number;
}

interface YahooOptionContract {
  strike?: number;
  lastPrice?: number;
  volume?: number;
  openInterest?: number;
  impliedVolatility?: number;
}

async function fetchOptionsChain(symbol: string): Promise<{
  expirationDate: number;
  calls: YahooOptionContract[];
  puts: YahooOptionContract[];
} | null> {
  try {
    const auth = await ensureCrumb();
    const url = auth
      ? `${YAHOO_API}/v7/finance/options/${encodeURIComponent(symbol)}?crumb=${encodeURIComponent(auth.crumb)}`
      : `${YAHOO_API}/v7/finance/options/${encodeURIComponent(symbol)}`;
    const headers: Record<string, string> = { 'User-Agent': YAHOO_UA };
    if (auth) headers['Cookie'] = auth.cookie;

    const resp = await fetch(url, { headers });

    if (!resp.ok) return null;

    const data = (await resp.json()) as any;
    const result = data?.optionChain?.result?.[0];
    if (!result || !result.options || result.options.length === 0) return null;

    const chain = result.options[0];
    return {
      expirationDate: chain.expirationDate ?? 0,
      calls: chain.calls ?? [],
      puts: chain.puts ?? [],
    };
  } catch (err) {
    console.error(`[OptionsFlow] Error fetching chain for ${symbol}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

export async function getOptionsFlow(symbols: string[]): Promise<UnusualOption[]> {
  const unusual: UnusualOption[] = [];

  for (const symbol of symbols) {
    const chain = await fetchOptionsChain(symbol);
    if (!chain) continue;

    const expiry = chain.expirationDate
      ? new Date(chain.expirationDate * 1000).toISOString().slice(0, 10)
      : 'unknown';

    const processContracts = (contracts: YahooOptionContract[], type: 'call' | 'put') => {
      for (const contract of contracts) {
        const volume = contract.volume ?? 0;
        const openInterest = contract.openInterest ?? 0;
        const lastPrice = contract.lastPrice ?? 0;
        const strike = contract.strike ?? 0;
        const iv = contract.impliedVolatility ?? 0;
        const premium = lastPrice * volume * 100;

        const isHighVolumeVsOI = openInterest > 0 && volume > 5 * openInterest;
        const isHighAbsoluteVolume = volume > 10000;
        const isHighPremium = premium > 100_000;

        if (isHighVolumeVsOI || isHighAbsoluteVolume || isHighPremium) {
          unusual.push({
            symbol,
            type,
            strike,
            expiry,
            volume,
            openInterest,
            premium: Math.round(premium),
            impliedVolatility: Math.round(iv * 10000) / 100,
          });
        }
      }
    };

    processContracts(chain.calls, 'call');
    processContracts(chain.puts, 'put');
  }

  unusual.sort((a, b) => b.premium - a.premium);

  return unusual;
}
