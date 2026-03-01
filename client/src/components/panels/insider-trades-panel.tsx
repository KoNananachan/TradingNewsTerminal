import { useState, useMemo } from 'react';
import { GlassCard } from '../common/glass-card';
import { useInsiderTrades, type InsiderTrade } from '../../api/hooks/use-insiders';
import { useAppStore } from '../../stores/use-app-store';
import { Users } from 'lucide-react';

const DAYS_OPTIONS = [7, 14, 30, 90] as const;

function formatCompact(n: number | null | undefined): string {
  if (n == null) return '--';
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toLocaleString();
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function InsiderTradesPanel() {
  const [days, setDays] = useState<number>(30);

  const watchlistTabs = useAppStore((s) => s.tabSymbols);
  const symbols = useMemo(() => {
    const allSymbols = new Set<string>();
    for (const syms of Object.values(watchlistTabs)) {
      for (const s of syms) allSymbols.add(s);
    }
    return Array.from(allSymbols);
  }, [watchlistTabs]);

  const { data, isLoading, error } = useInsiderTrades(symbols, days);
  const setSelectedSymbol = useAppStore((s) => s.setSelectedSymbol);

  const trades = useMemo(() => {
    if (!data?.length) return [];
    return [...data].sort((a, b) => new Date(b.tradeDate).getTime() - new Date(a.tradeDate).getTime());
  }, [data]);

  return (
    <GlassCard
      title={
        <span className="flex items-center gap-1.5">
          <Users className="w-3 h-3" />
          INSIDER TRADES
        </span>
      }
      headerRight={
        <span className="text-[8px] font-mono text-neutral/50">
          {trades.length} trades
        </span>
      }
      className="h-full"
    >
      {/* Days selector */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-border/30 bg-black/20">
        <span className="text-[8px] font-mono text-neutral/50 uppercase">Range:</span>
        <div className="flex items-center gap-0.5">
          {DAYS_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-2 py-0.5 text-[9px] font-mono font-black transition-all ${
                days === d
                  ? 'bg-accent/20 text-accent'
                  : 'text-neutral/50 hover:text-white'
              }`}
            >
              {d}D
            </button>
          ))}
        </div>
      </div>

      {/* Table header */}
      <div className="shrink-0 grid grid-cols-[55px_50px_1fr_55px_30px_55px_55px_60px] text-[7px] font-mono text-neutral/40 uppercase tracking-wider px-3 py-1 border-b border-border/10 bg-black/10">
        <span>Date</span>
        <span>Symbol</span>
        <span>Insider</span>
        <span>Title</span>
        <span>Type</span>
        <span className="text-right">Shares</span>
        <span className="text-right">Price</span>
        <span className="text-right">Value</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto no-scrollbar">
        {isLoading && (
          <div className="flex items-center justify-center py-8 text-[10px] font-mono text-neutral/40 uppercase tracking-widest">
            Loading...
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center py-8 text-[10px] font-mono text-bearish/60 uppercase tracking-widest">
            Failed to load insider data
          </div>
        )}
        {!isLoading && !error && symbols.length === 0 && (
          <div className="flex items-center justify-center py-8 text-[10px] font-mono text-neutral/40 uppercase tracking-widest">
            Add symbols to watchlist
          </div>
        )}
        {!isLoading && !error && symbols.length > 0 && trades.length === 0 && (
          <div className="flex items-center justify-center py-8 text-[10px] font-mono text-neutral/40 uppercase tracking-widest">
            No insider trades found
          </div>
        )}

        {trades.map((trade) => {
          const isPurchase = trade.transactionType === 'P' || trade.transactionType.toLowerCase().includes('purchase');

          return (
            <button
              key={trade.id}
              onClick={() => setSelectedSymbol(trade.symbol)}
              className={`w-full text-left grid grid-cols-[55px_50px_1fr_55px_30px_55px_55px_60px] text-[10px] font-mono px-3 py-1.5 border-b hover:bg-accent/[0.04] transition-colors items-center ${
                trade.clusterBuy
                  ? 'border-amber-500/30 bg-amber-500/[0.04] border-l-2 border-l-amber-500'
                  : 'border-border/5'
              }`}
            >
              <span className="text-neutral/50">{formatDate(trade.tradeDate)}</span>
              <span className="font-bold text-accent">{trade.symbol}</span>
              <span className="text-gray-300 truncate pr-2">{trade.ownerName}</span>
              <span className="text-neutral/40 truncate">{trade.ownerTitle ?? '--'}</span>
              <span
                className={`font-bold text-center ${isPurchase ? 'text-bullish' : 'text-bearish'}`}
              >
                {isPurchase ? 'P' : 'S'}
              </span>
              <span className="text-right text-gray-300">{formatCompact(trade.shares)}</span>
              <span className="text-right text-gray-400">
                {trade.pricePerShare != null ? `$${trade.pricePerShare.toFixed(2)}` : '--'}
              </span>
              <span className="text-right font-bold text-gray-200">
                {formatCompact(trade.totalValue)}
              </span>
            </button>
          );
        })}
      </div>
    </GlassCard>
  );
}
