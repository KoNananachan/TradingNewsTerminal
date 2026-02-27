const YAHOO_API = 'https://query1.finance.yahoo.com';

interface YahooQuoteResult {
  symbol: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  regularMarketVolume?: number;
  marketCap?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketPreviousClose?: number;
}

export async function getQuote(symbol: string) {
  try {
    const url = `${YAHOO_API}/v6/finance/quote?symbols=${encodeURIComponent(symbol)}`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!resp.ok) {
      // Fallback to v8 chart API for price data
      return await getQuoteViaChart(symbol);
    }

    const data = (await resp.json()) as any;
    const result: YahooQuoteResult = data?.quoteResponse?.result?.[0];
    if (!result) return await getQuoteViaChart(symbol);

    return {
      symbol: result.symbol,
      name: result.shortName || result.longName || symbol,
      price: result.regularMarketPrice ?? 0,
      change: result.regularMarketChange ?? null,
      changePercent: result.regularMarketChangePercent ?? null,
      volume: result.regularMarketVolume ?? null,
      marketCap: result.marketCap ?? null,
      dayHigh: result.regularMarketDayHigh ?? null,
      dayLow: result.regularMarketDayLow ?? null,
      previousClose: result.regularMarketPreviousClose ?? null,
    };
  } catch (err) {
    console.error(`[Yahoo] Error fetching quote for ${symbol}:`, err instanceof Error ? err.message : err);
    return await getQuoteViaChart(symbol).catch(() => null);
  }
}

async function getQuoteViaChart(symbol: string) {
  const url = `${YAHOO_API}/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1m`;
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  if (!resp.ok) return null;
  const data = (await resp.json()) as any;
  const meta = data?.chart?.result?.[0]?.meta;
  if (!meta) return null;

  return {
    symbol: meta.symbol || symbol,
    name: meta.shortName || meta.longName || symbol,
    price: meta.regularMarketPrice ?? 0,
    change: meta.regularMarketPrice && meta.previousClose
      ? meta.regularMarketPrice - meta.previousClose
      : null,
    changePercent: meta.regularMarketPrice && meta.previousClose
      ? ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100
      : null,
    volume: meta.regularMarketVolume ?? null,
    marketCap: null,
    dayHigh: meta.regularMarketDayHigh ?? null,
    dayLow: meta.regularMarketDayLow ?? null,
    previousClose: meta.previousClose ?? null,
  };
}

export async function getQuotes(symbols: string[]) {
  // Try batch quote first
  try {
    const url = `${YAHOO_API}/v6/finance/quote?symbols=${symbols.map(encodeURIComponent).join(',')}`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (resp.ok) {
      const data = (await resp.json()) as any;
      const results: YahooQuoteResult[] = data?.quoteResponse?.result ?? [];
      if (results.length > 0) {
        return results.map((r) => ({
          symbol: r.symbol,
          name: r.shortName || r.longName || r.symbol,
          price: r.regularMarketPrice ?? 0,
          change: r.regularMarketChange ?? null,
          changePercent: r.regularMarketChangePercent ?? null,
          volume: r.regularMarketVolume ?? null,
          marketCap: r.marketCap ?? null,
          dayHigh: r.regularMarketDayHigh ?? null,
          dayLow: r.regularMarketDayLow ?? null,
          previousClose: r.regularMarketPreviousClose ?? null,
        }));
      }
    }
  } catch {
    // Fall through to individual fetches
  }

  // Fallback: fetch individually via chart API
  const results = await Promise.allSettled(symbols.map((s) => getQuote(s)));
  return results
    .filter(
      (r): r is PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof getQuote>>>> =>
        r.status === 'fulfilled' && r.value !== null,
    )
    .map((r) => r.value);
}

export async function getHistory(symbol: string, period1?: string) {
  try {
    const startDate = period1 || '2024-01-01';
    const p1 = Math.floor(new Date(startDate).getTime() / 1000);
    const p2 = Math.floor(Date.now() / 1000);
    const url = `${YAHOO_API}/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${p1}&period2=${p2}&interval=1d`;

    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    if (!resp.ok) return [];

    const data = (await resp.json()) as any;
    const result = data?.chart?.result?.[0];
    if (!result) return [];

    const timestamps: number[] = result.timestamp || [];
    const quotes = result.indicators?.quote?.[0] || {};

    return timestamps.map((ts: number, i: number) => ({
      date: new Date(ts * 1000).toISOString().slice(0, 10),
      open: quotes.open?.[i] ?? null,
      high: quotes.high?.[i] ?? null,
      low: quotes.low?.[i] ?? null,
      close: quotes.close?.[i] ?? null,
      volume: quotes.volume?.[i] ?? null,
    }));
  } catch (err) {
    console.error(`[Yahoo] Error fetching history for ${symbol}:`, err instanceof Error ? err.message : err);
    return [];
  }
}
