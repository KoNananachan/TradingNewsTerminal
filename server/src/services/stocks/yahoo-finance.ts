const YAHOO_API = 'https://query1.finance.yahoo.com';

const YAHOO_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

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
  regularMarketOpen?: number;
  trailingPE?: number;
  forwardPE?: number;
  epsTrailingTwelveMonths?: number;
  epsForward?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  averageDailyVolume3Month?: number;
  trailingAnnualDividendYield?: number;
  trailingAnnualDividendRate?: number;
  beta?: number;
  sharesOutstanding?: number;
  floatShares?: number;
  bookValue?: number;
  priceToBook?: number;
  shortRatio?: number;
  earningsTimestamp?: number;
  fiftyDayAverage?: number;
  twoHundredDayAverage?: number;
  fiftyDayAverageChangePercent?: number;
  twoHundredDayAverageChangePercent?: number;
}

export interface StockProfile {
  sector: string | null;
  industry: string | null;
  description: string | null;
  employees: number | null;
  website: string | null;
  city: string | null;
  country: string | null;
  // Financial metrics
  targetMeanPrice: number | null;
  targetHighPrice: number | null;
  targetLowPrice: number | null;
  numberOfAnalysts: number | null;
  recommendationKey: string | null;
  profitMargins: number | null;
  returnOnEquity: number | null;
  returnOnAssets: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  totalRevenue: number | null;
  grossProfit: number | null;
  ebitda: number | null;
  totalDebt: number | null;
  totalCash: number | null;
  freeCashflow: number | null;
  operatingCashflow: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
}

export async function getQuote(symbol: string) {
  try {
    const auth = await ensureCrumb();
    if (!auth) return await getQuoteViaChart(symbol);

    const url = `${YAHOO_API}/v7/finance/quote?symbols=${encodeURIComponent(symbol)}&crumb=${encodeURIComponent(auth.crumb)}`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': YAHOO_UA, 'Cookie': auth.cookie },
    });

    if (!resp.ok) {
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
      open: result.regularMarketOpen ?? null,
      pe: result.trailingPE ?? null,
      forwardPE: result.forwardPE ?? null,
      eps: result.epsTrailingTwelveMonths ?? null,
      epsForward: result.epsForward ?? null,
      fiftyTwoWeekHigh: result.fiftyTwoWeekHigh ?? null,
      fiftyTwoWeekLow: result.fiftyTwoWeekLow ?? null,
      avgVolume: result.averageDailyVolume3Month ?? null,
      dividendYield: result.trailingAnnualDividendYield ?? null,
      dividendRate: result.trailingAnnualDividendRate ?? null,
      beta: result.beta ?? null,
      sharesOutstanding: result.sharesOutstanding ?? null,
      floatShares: result.floatShares ?? null,
      bookValue: result.bookValue ?? null,
      priceToBook: result.priceToBook ?? null,
      shortRatio: result.shortRatio ?? null,
      earningsDate: result.earningsTimestamp ? new Date(result.earningsTimestamp * 1000).toISOString() : null,
      fiftyDayAvg: result.fiftyDayAverage ?? null,
      twoHundredDayAvg: result.twoHundredDayAverage ?? null,
      fiftyDayAvgChg: result.fiftyDayAverageChangePercent ?? null,
      twoHundredDayAvgChg: result.twoHundredDayAverageChangePercent ?? null,
    };
  } catch (err) {
    console.error(`[Yahoo] Error fetching quote for ${symbol}:`, err instanceof Error ? err.message : err);
    return await getQuoteViaChart(symbol).catch(() => null);
  }
}

async function getQuoteViaChart(symbol: string) {
  const url = `${YAHOO_API}/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1m`;
  const resp = await fetch(url, {
    headers: { 'User-Agent': YAHOO_UA },
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
  // Try batch quote with crumb auth (v7)
  try {
    const auth = await ensureCrumb();
    if (!auth) throw new Error('No crumb');

    const url = `${YAHOO_API}/v7/finance/quote?symbols=${symbols.map(encodeURIComponent).join(',')}&crumb=${encodeURIComponent(auth.crumb)}`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': YAHOO_UA, 'Cookie': auth.cookie },
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
          avgVolume: r.averageDailyVolume3Month ?? null,
          marketCap: r.marketCap ?? null,
          dayHigh: r.regularMarketDayHigh ?? null,
          dayLow: r.regularMarketDayLow ?? null,
          previousClose: r.regularMarketPreviousClose ?? null,
          earningsDate: r.earningsTimestamp ? new Date(r.earningsTimestamp * 1000).toISOString() : null,
          eps: r.epsTrailingTwelveMonths ?? null,
          epsForward: r.epsForward ?? null,
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

const RANGE_INTERVAL_MAP: Record<string, string> = {
  '1d': '5m',
  '5d': '15m',
  '1mo': '1h',
  '3mo': '1d',
  '6mo': '1d',
  '1y': '1d',
  '5y': '1d',
  'max': '1d',
};

export async function getHistory(
  symbol: string,
  options?: { range?: string; interval?: string },
) {
  try {
    const range = options?.range || '1y';
    const interval = options?.interval || RANGE_INTERVAL_MAP[range] || '1d';
    const isIntraday = ['5m', '15m', '1h'].includes(interval);

    const url = `${YAHOO_API}/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;

    const resp = await fetch(url, {
      headers: { 'User-Agent': YAHOO_UA },
    });
    if (!resp.ok) return [];

    const data = (await resp.json()) as any;
    const result = data?.chart?.result?.[0];
    if (!result) return [];

    const timestamps: number[] = result.timestamp || [];
    const quotes = result.indicators?.quote?.[0] || {};

    return timestamps.map((ts: number, i: number) => ({
      date: isIntraday ? ts : new Date(ts * 1000).toISOString().slice(0, 10),
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

// ── Yahoo crumb authentication (required for v10 quoteSummary) ──

let yahooCrumb: string | null = null;
let yahooCookie: string | null = null;
let crumbExpiry = 0;
const CRUMB_TTL = 30 * 60_000; // 30 min

export async function ensureCrumb(): Promise<{ crumb: string; cookie: string } | null> {
  if (yahooCrumb && yahooCookie && Date.now() < crumbExpiry) {
    return { crumb: yahooCrumb, cookie: yahooCookie };
  }

  try {
    // Step 1: Get session cookie from fc.yahoo.com
    const sessionResp = await fetch('https://fc.yahoo.com', {
      headers: { 'User-Agent': YAHOO_UA },
      redirect: 'manual',
    });
    const setCookies = sessionResp.headers.getSetCookie?.() ?? [];
    const a3Cookie = setCookies
      .map((c) => c.split(';')[0])
      .find((c) => c.startsWith('A3='));
    if (!a3Cookie) return null;

    // Step 2: Get crumb using the cookie
    const crumbResp = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
      headers: {
        'User-Agent': YAHOO_UA,
        'Cookie': a3Cookie,
      },
    });
    if (!crumbResp.ok) return null;
    const crumb = await crumbResp.text();
    if (!crumb || crumb.length > 50) return null;

    yahooCrumb = crumb;
    yahooCookie = a3Cookie;
    crumbExpiry = Date.now() + CRUMB_TTL;
    return { crumb, cookie: a3Cookie };
  } catch (err) {
    console.error('[Yahoo] Failed to get crumb:', err instanceof Error ? err.message : err);
    return null;
  }
}

// Fetch company profile and financial metrics via quoteSummary API
export async function getProfile(symbol: string): Promise<StockProfile | null> {
  try {
    const auth = await ensureCrumb();
    if (!auth) return null;

    const modules = 'assetProfile,financialData';
    const url = `${YAHOO_API}/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}&crumb=${encodeURIComponent(auth.crumb)}`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent': YAHOO_UA,
        'Cookie': auth.cookie,
      },
    });

    if (resp.status === 401) {
      // Crumb expired, invalidate and retry once
      yahooCrumb = null;
      const retry = await ensureCrumb();
      if (!retry) return null;
      const retryUrl = `${YAHOO_API}/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}&crumb=${encodeURIComponent(retry.crumb)}`;
      const retryResp = await fetch(retryUrl, {
        headers: { 'User-Agent': YAHOO_UA, 'Cookie': retry.cookie },
      });
      if (!retryResp.ok) return null;
      return parseProfileResponse(await retryResp.json());
    }

    if (!resp.ok) return null;
    return parseProfileResponse(await resp.json());
  } catch (err) {
    console.error(`[Yahoo] Error fetching profile for ${symbol}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

function parseProfileResponse(data: any): StockProfile | null {
  const result = data?.quoteSummary?.result?.[0];
  if (!result) return null;

  const ap = result.assetProfile || {};
  const fd = result.financialData || {};

  return {
    sector: ap.sector || null,
    industry: ap.industry || null,
    description: ap.longBusinessSummary?.slice(0, 1000) || null,
    employees: ap.fullTimeEmployees || null,
    website: ap.website || null,
    city: ap.city || null,
    country: ap.country || null,
    targetMeanPrice: fd.targetMeanPrice?.raw ?? null,
    targetHighPrice: fd.targetHighPrice?.raw ?? null,
    targetLowPrice: fd.targetLowPrice?.raw ?? null,
    numberOfAnalysts: fd.numberOfAnalystOpinions?.raw ?? null,
    recommendationKey: fd.recommendationKey || null,
    profitMargins: fd.profitMargins?.raw ?? null,
    returnOnEquity: fd.returnOnEquity?.raw ?? null,
    returnOnAssets: fd.returnOnAssets?.raw ?? null,
    revenueGrowth: fd.revenueGrowth?.raw ?? null,
    earningsGrowth: fd.earningsGrowth?.raw ?? null,
    totalRevenue: fd.totalRevenue?.raw ?? null,
    grossProfit: fd.grossProfit?.raw ?? null,
    ebitda: fd.ebitda?.raw ?? null,
    totalDebt: fd.totalDebt?.raw ?? null,
    totalCash: fd.totalCash?.raw ?? null,
    freeCashflow: fd.freeCashflow?.raw ?? null,
    operatingCashflow: fd.operatingCashflow?.raw ?? null,
    debtToEquity: fd.debtToEquity?.raw ?? null,
    currentRatio: fd.currentRatio?.raw ?? null,
  };
}

// ── Extended profile (Bloomberg-level data) ──

export interface ExtendedStockData {
  keyStats: {
    enterpriseValue: number | null;
    pegRatio: number | null;
    shortPercentOfFloat: number | null;
    sharesShort: number | null;
    sharesShortPriorMonth: number | null;
    dateShortInterest: string | null;
    heldPercentInsiders: number | null;
    heldPercentInstitutions: number | null;
    fiftyTwoWeekChange: number | null;
    sp500FiftyTwoWeekChange: number | null;
    lastDividendValue: number | null;
    lastDividendDate: string | null;
  } | null;
  earningsHistory: Array<{
    quarter: string;
    epsEstimate: number | null;
    epsActual: number | null;
    epsDifference: number | null;
    surprisePercent: number | null;
  }>;
  earningsTrend: Array<{
    period: string;
    endDate: string | null;
    growth: number | null;
    earningsEstimate: { avg: number | null; low: number | null; high: number | null; numberOfAnalysts: number | null };
    revenueEstimate: { avg: number | null; low: number | null; high: number | null; numberOfAnalysts: number | null };
  }>;
  recommendationTrend: Array<{
    period: string;
    strongBuy: number;
    buy: number;
    hold: number;
    sell: number;
    strongSell: number;
  }>;
  upgradeDowngradeHistory: Array<{
    date: string;
    firm: string;
    action: string;
    fromGrade: string;
    toGrade: string;
  }>;
  majorHolders: {
    insidersPercentHeld: number | null;
    institutionsPercentHeld: number | null;
    institutionsFloatPercentHeld: number | null;
    institutionsCount: number | null;
  } | null;
  secFilings: Array<{
    date: string;
    type: string;
    title: string;
    url: string;
  }>;
}

export async function getExtendedProfile(symbol: string): Promise<ExtendedStockData | null> {
  try {
    const auth = await ensureCrumb();
    if (!auth) return null;

    const modules = 'defaultKeyStatistics,earningsHistory,earningsTrend,recommendationTrend,upgradeDowngradeHistory,majorHoldersBreakdown,secFilings';
    const url = `${YAHOO_API}/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}&crumb=${encodeURIComponent(auth.crumb)}`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': YAHOO_UA, 'Cookie': auth.cookie },
    });

    if (resp.status === 401) {
      yahooCrumb = null;
      const retry = await ensureCrumb();
      if (!retry) return null;
      const retryUrl = `${YAHOO_API}/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}&crumb=${encodeURIComponent(retry.crumb)}`;
      const retryResp = await fetch(retryUrl, {
        headers: { 'User-Agent': YAHOO_UA, 'Cookie': retry.cookie },
      });
      if (!retryResp.ok) return null;
      return parseExtendedResponse(await retryResp.json());
    }

    if (!resp.ok) return null;
    return parseExtendedResponse(await resp.json());
  } catch (err) {
    console.error(`[Yahoo] Error fetching extended profile for ${symbol}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

function parseExtendedResponse(data: any): ExtendedStockData | null {
  const result = data?.quoteSummary?.result?.[0];
  if (!result) return null;

  const ks = result.defaultKeyStatistics || {};
  const eh = result.earningsHistory?.history || [];
  const et = result.earningsTrend?.trend || [];
  const rt = result.recommendationTrend?.trend || [];
  const udh = result.upgradeDowngradeHistory?.history || [];
  const mh = result.majorHoldersBreakdown || {};
  const sf = result.secFilings?.filings || [];

  return {
    keyStats: {
      enterpriseValue: ks.enterpriseValue?.raw ?? null,
      pegRatio: ks.pegRatio?.raw ?? null,
      shortPercentOfFloat: ks.shortPercentOfFloat?.raw ?? null,
      sharesShort: ks.sharesShort?.raw ?? null,
      sharesShortPriorMonth: ks.sharesShortPriorMonth?.raw ?? null,
      dateShortInterest: ks.dateShortInterest?.fmt ?? null,
      heldPercentInsiders: ks.heldPercentInsiders?.raw ?? null,
      heldPercentInstitutions: ks.heldPercentInstitutions?.raw ?? null,
      fiftyTwoWeekChange: ks['52WeekChange']?.raw ?? null,
      sp500FiftyTwoWeekChange: ks.SandP52WeekChange?.raw ?? null,
      lastDividendValue: ks.lastDividendValue?.raw ?? null,
      lastDividendDate: ks.lastDividendDate?.fmt ?? null,
    },
    earningsHistory: eh.slice(0, 8).map((e: any) => ({
      quarter: e.quarter?.fmt ?? e.period ?? '',
      epsEstimate: e.epsEstimate?.raw ?? null,
      epsActual: e.epsActual?.raw ?? null,
      epsDifference: e.epsDifference?.raw ?? null,
      surprisePercent: e.surprisePercent?.raw ?? null,
    })),
    earningsTrend: et.map((e: any) => ({
      period: e.period ?? '',
      endDate: e.endDate ?? null,
      growth: e.growth?.raw ?? null,
      earningsEstimate: {
        avg: e.earningsEstimate?.avg?.raw ?? null,
        low: e.earningsEstimate?.low?.raw ?? null,
        high: e.earningsEstimate?.high?.raw ?? null,
        numberOfAnalysts: e.earningsEstimate?.numberOfAnalysts?.raw ?? null,
      },
      revenueEstimate: {
        avg: e.revenueEstimate?.avg?.raw ?? null,
        low: e.revenueEstimate?.low?.raw ?? null,
        high: e.revenueEstimate?.high?.raw ?? null,
        numberOfAnalysts: e.revenueEstimate?.numberOfAnalysts?.raw ?? null,
      },
    })),
    recommendationTrend: rt.map((r: any) => ({
      period: r.period ?? '',
      strongBuy: r.strongBuy ?? 0,
      buy: r.buy ?? 0,
      hold: r.hold ?? 0,
      sell: r.sell ?? 0,
      strongSell: r.strongSell ?? 0,
    })),
    upgradeDowngradeHistory: udh.slice(0, 30).map((u: any) => ({
      date: u.epochGradeDate ? new Date(u.epochGradeDate * 1000).toISOString().slice(0, 10) : '',
      firm: u.firm ?? '',
      action: u.action ?? '',
      fromGrade: u.fromGrade ?? '',
      toGrade: u.toGrade ?? '',
    })),
    majorHolders: {
      insidersPercentHeld: mh.insidersPercentHeld?.raw ?? null,
      institutionsPercentHeld: mh.institutionsPercentHeld?.raw ?? null,
      institutionsFloatPercentHeld: mh.institutionsFloatPercentHeld?.raw ?? null,
      institutionsCount: mh.institutionsCount?.raw ?? null,
    },
    secFilings: sf.slice(0, 20).map((f: any) => ({
      date: f.date ?? '',
      type: f.type ?? '',
      title: f.title ?? '',
      url: f.edgarUrl ?? '',
    })),
  };
}

// ── Insider Transactions via quoteSummary ──

export interface YahooInsiderTx {
  ownerName: string;
  ownerTitle: string | null;
  transactionType: string; // 'P' purchase, 'S' sale
  shares: number;
  value: number | null;
  transactionDate: string; // ISO date
  filingDate: string | null;
}

export async function getInsiderTransactions(symbol: string): Promise<YahooInsiderTx[]> {
  try {
    const auth = await ensureCrumb();
    if (!auth) return [];

    const url = `${YAHOO_API}/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=insiderTransactions&crumb=${encodeURIComponent(auth.crumb)}`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': YAHOO_UA, 'Cookie': auth.cookie },
    });

    if (resp.status === 401) {
      yahooCrumb = null;
      const retry = await ensureCrumb();
      if (!retry) return [];
      const retryUrl = `${YAHOO_API}/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=insiderTransactions&crumb=${encodeURIComponent(retry.crumb)}`;
      const retryResp = await fetch(retryUrl, {
        headers: { 'User-Agent': YAHOO_UA, 'Cookie': retry.cookie },
      });
      if (!retryResp.ok) return [];
      return parseInsiderResponse(await retryResp.json());
    }

    if (!resp.ok) return [];
    return parseInsiderResponse(await resp.json());
  } catch (err) {
    console.error(`[Yahoo] Error fetching insider tx for ${symbol}:`, err instanceof Error ? err.message : err);
    return [];
  }
}

function parseInsiderResponse(data: any): YahooInsiderTx[] {
  const txns = data?.quoteSummary?.result?.[0]?.insiderTransactions?.transactions;
  if (!Array.isArray(txns)) return [];

  const results = txns
    .filter((t: any) => t.shares?.raw && t.startDate?.raw)
    .map((t: any) => {
      const shares = Math.abs(t.shares.raw);
      const txDate = new Date(t.startDate.raw * 1000).toISOString().slice(0, 10);
      const text = (t.transactionText || '').toLowerCase();

      // Parse transaction type and price from transactionText
      let txType = 'A'; // Default to Award if unknown
      let price: number | null = null;

      if (text.includes('sale')) {
        txType = 'S';
      } else if (text.includes('purchase')) {
        txType = 'P';
      } else if (text.includes('award') || text.includes('grant')) {
        txType = 'A';
      } else if (text.includes('gift')) {
        txType = 'G';
      } else if (text.includes('exercise')) {
        txType = 'X';
      } else if (t.shares.raw < 0) {
        txType = 'S';
      } else if (t.value?.raw > 0) {
        // Has real value → likely a purchase
        txType = 'P';
      }

      // Extract price from "at price X.XX per share"
      const priceMatch = text.match(/price\s+([\d.]+)\s+per/);
      if (priceMatch) {
        const parsed = parseFloat(priceMatch[1]);
        if (parsed > 0) price = parsed;
      }

      const value = t.value?.raw && t.value.raw > 0 ? t.value.raw : (price && shares ? Math.round(price * shares) : null);

      return {
        ownerName: t.filerName || 'Unknown',
        ownerTitle: t.filerRelation || null,
        transactionType: txType,
        shares,
        value,
        transactionDate: txDate,
        filingDate: txDate,
      };
    });

  // Deduplicate (Yahoo sometimes returns the same transaction multiple times)
  const seen = new Set<string>();
  return results.filter(r => {
    const key = `${r.ownerName}|${r.transactionDate}|${r.shares}|${r.transactionType}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
