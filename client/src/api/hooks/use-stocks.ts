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
  pe?: number | null;
  eps?: number | null;
  fiftyTwoWeekHigh?: number | null;
  fiftyTwoWeekLow?: number | null;
  avgVolume?: number | null;
  dividendYield?: number | null;
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
    refetchInterval: 10_000,
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

export function useStockDetail(symbol: string | null) {
  return useQuery({
    queryKey: ['stocks', symbol],
    queryFn: () => api.get<StockDetail>(`/stocks/${symbol}`),
    enabled: symbol !== null,
  });
}
