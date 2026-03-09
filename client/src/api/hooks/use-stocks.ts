import { useQuery } from '@tanstack/react-query';
import { api } from '../client';

export interface StockQuote {
  id: number;
  symbol: string;
  name: string | null;
  price: number;
  change: number | null;
  changePercent: number | null;
  volume: number | null;
  marketCap: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  previousClose: number | null;
  updatedAt: string;
  open?: number | null;
  pe?: number | null;
  forwardPE?: number | null;
  eps?: number | null;
  epsForward?: number | null;
  fiftyTwoWeekHigh?: number | null;
  fiftyTwoWeekLow?: number | null;
  avgVolume?: number | null;
  dividendYield?: number | null;
  dividendRate?: number | null;
  beta?: number | null;
  sharesOutstanding?: number | null;
  floatShares?: number | null;
  bookValue?: number | null;
  priceToBook?: number | null;
  shortRatio?: number | null;
  earningsDate?: string | null;
  fiftyDayAvg?: number | null;
  twoHundredDayAvg?: number | null;
  fiftyDayAvgChg?: number | null;
  twoHundredDayAvgChg?: number | null;
}

export interface StockProfile {
  sector: string | null;
  industry: string | null;
  description: string | null;
  employees: number | null;
  website: string | null;
  city: string | null;
  country: string | null;
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

interface HistoryPoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface StockDetail {
  quote: StockQuote | null;
  profile: StockProfile | null;
  history: HistoryPoint[];
  recommendations: Array<{
    id: number;
    symbol: string;
    action: string;
    confidence: number;
    reason: string | null;
    createdAt: string;
    article: { id: number; title: string; scrapedAt: string };
  }>;
}

export function useStockQuotes() {
  return useQuery({
    queryKey: ['stocks', 'quotes'],
    queryFn: () => api.get<StockQuote[]>('/stocks/quotes'),
    refetchInterval: 60_000,
  });
}

export function useStockNames(symbols: string[]) {
  const key = symbols.slice().sort().join(',');
  return useQuery({
    queryKey: ['stock-names', key],
    queryFn: () => api.get<Record<string, string>>(`/stocks/names?symbols=${symbols.join(',')}`),
    enabled: symbols.length > 0,
    staleTime: 5 * 60_000,
  });
}

export function useStockDetail(
  symbol: string | null,
  options?: { range?: string; interval?: string },
) {
  const range = options?.range;
  const interval = options?.interval;
  const params = new URLSearchParams();
  if (range) params.set('range', range);
  if (interval) params.set('interval', interval);
  const qs = params.toString();

  return useQuery({
    queryKey: ['stocks', symbol, range, interval],
    queryFn: () => api.get<StockDetail>(`/stocks/${symbol}${qs ? `?${qs}` : ''}`),
    enabled: symbol !== null,
  });
}
