import { useState, useMemo } from 'react';
import { GlassCard } from '../common/glass-card';
import { useInsiderTrades, type InsiderTrade } from '../../api/hooks/use-insiders';
import { useWatchlist } from '../../api/hooks/use-watchlist';
import { useAppStore } from '../../stores/use-app-store';
import { Users } from 'lucide-react';
import { useT, type TranslationKey } from '../../i18n';

const DAYS_OPTIONS = [7, 14, 30, 90] as const;
const TYPE_FILTERS: { value: string; key: TranslationKey }[] = [
  { value: 'ALL', key: 'insiderFilterAll' },
  { value: 'PS', key: 'insiderFilterBuySell' },
  { value: 'P', key: 'buy' },
  { value: 'S', key: 'sell' },
];

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

export function InsiderTradesContent() {
  const t = useT();
  const [days, setDays] = useState<number>(30);
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  const watchlistTabs = useAppStore((s) => s.tabSymbols);
  const { data: serverWatchlist } = useWatchlist();
  const symbols = useMemo(() => {
    const allSymbols = new Set<string>();
    // From tab assignments (localStorage)
    for (const syms of Object.values(watchlistTabs)) {
      for (const s of syms) allSymbols.add(s);
    }
    // From server-side watchlist
    if (serverWatchlist) {
      for (const item of serverWatchlist) allSymbols.add(item.symbol);
    }
    return Array.from(allSymbols);
  }, [watchlistTabs, serverWatchlist]);

  const { data, isLoading, error } = useInsiderTrades(symbols, days);
  const setSelectedSymbol = useAppStore((s) => s.setSelectedSymbol);

  const trades = useMemo(() => {
    if (!data?.length) return [];
    let filtered = data;
    if (typeFilter === 'PS') {
      filtered = data.filter(t => t.transactionType === 'P' || t.transactionType === 'S');
    } else if (typeFilter !== 'ALL') {
      filtered = data.filter(t => t.transactionType === typeFilter);
    }
    return [...filtered].sort((a, b) => new Date(b.tradeDate).getTime() - new Date(a.tradeDate).getTime());
  }, [data, typeFilter]);

  return (
    <>
      {/* Filters */}
      <div className="shrink-0 flex items-center gap-3 px-3 py-1.5 border-b border-border/30 bg-black/20">
        <div className="flex items-center gap-1">
          <span className="text-[8px] font-mono text-neutral/50 uppercase">{t('range')}:</span>
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
        <div className="flex items-center gap-1">
          <span className="text-[8px] font-mono text-neutral/50 uppercase">{t('alertType')}:</span>
          <div className="flex items-center gap-0.5">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setTypeFilter(f.value)}
                className={`px-2 py-0.5 text-[9px] font-mono font-black transition-all ${
                  typeFilter === f.value
                    ? 'bg-accent/20 text-accent'
                    : 'text-neutral/50 hover:text-white'
                }`}
              >
                {t(f.key)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table header */}
      <div className="shrink-0 grid grid-cols-[55px_50px_1fr_55px_30px_55px_55px_60px] text-[7px] font-mono text-neutral/40 uppercase tracking-wider px-3 py-1 border-b border-border/10 bg-black/10">
        <span>{t('date')}</span>
        <span>{t('symbol')}</span>
        <span>{t('insider')}</span>
        <span>{t('title')}</span>
        <span>{t('alertType')}</span>
        <span className="text-right">{t('shares')}</span>
        <span className="text-right">{t('price')}</span>
        <span className="text-right">{t('value')}</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto no-scrollbar">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <div className="w-4 h-4 border-2 border-accent/30 border-t-accent animate-spin" />
            <span className="text-[10px] font-mono text-neutral/40 uppercase tracking-widest">{t('loading')}</span>
          </div>
        )}
        {error && (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <span className="text-[10px] font-mono text-bearish/60 uppercase tracking-widest">{t('insiderLoadFailed')}</span>
            <button onClick={() => window.location.reload()} className="text-[9px] font-mono text-accent hover:text-white border border-accent/30 px-2 py-0.5 transition-colors">{t('retry')}</button>
          </div>
        )}
        {!isLoading && !error && symbols.length === 0 && (
          <div className="flex items-center justify-center py-8 text-[10px] font-mono text-neutral/40 uppercase tracking-widest">
            {t('addToWatchlist')}
          </div>
        )}
        {!isLoading && !error && symbols.length > 0 && trades.length === 0 && (
          <div className="flex items-center justify-center py-8 text-[10px] font-mono text-neutral/40 uppercase tracking-widest">
            {t('noInsiderTrades')}
          </div>
        )}

        {trades.map((trade) => {
          const typeColor = trade.transactionType === 'P' ? 'text-bullish'
            : trade.transactionType === 'S' ? 'text-bearish'
            : 'text-neutral/50';
          const typeLabel = trade.transactionType === 'P' ? 'P'
            : trade.transactionType === 'S' ? 'S'
            : trade.transactionType === 'A' ? 'A'
            : trade.transactionType === 'G' ? 'G'
            : trade.transactionType === 'X' ? 'X'
            : trade.transactionType;

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
              <span className={`font-bold text-center ${typeColor}`}>
                {typeLabel}
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
    </>
  );
}

export function InsiderTradesPanel() {
  const t = useT();
  return (
    <GlassCard
      title={
        <span className="flex items-center gap-1.5">
          <Users className="w-3 h-3" />
          {t('insiderTrades')}
        </span>
      }
      className="h-full"
    >
      <InsiderTradesContent />
    </GlassCard>
  );
}
