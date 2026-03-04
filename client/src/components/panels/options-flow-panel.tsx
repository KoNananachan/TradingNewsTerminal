import { useState, useMemo } from 'react';
import { GlassCard } from '../common/glass-card';
import { useOptionsFlow, type OptionsFlow } from '../../api/hooks/use-options';
import { useWatchlist as useWatchlistData } from '../../api/hooks/use-watchlist';
import { useAppStore } from '../../stores/use-app-store';
import { Zap } from 'lucide-react';

const MIN_PREMIUM_OPTIONS = [
  { label: '50K', value: 50_000 },
  { label: '100K', value: 100_000 },
  { label: '500K', value: 500_000 },
] as const;

function formatCompact(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K';
  return n.toFixed(0);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function OptionsFlowPanel() {
  const watchlistTabs = useAppStore((s) => s.tabSymbols);
  const { data: serverWatchlist } = useWatchlistData();
  const watchlistSymbols = useMemo(() => {
    const allSymbols = new Set<string>();
    for (const syms of Object.values(watchlistTabs)) {
      for (const s of syms) allSymbols.add(s);
    }
    if (serverWatchlist) {
      for (const item of serverWatchlist) allSymbols.add(item.symbol);
    }
    return Array.from(allSymbols);
  }, [watchlistTabs, serverWatchlist]);

  const [manualInput, setManualInput] = useState('');
  const [useWatchlist, setUseWatchlist] = useState(true);
  const [minPremium, setMinPremium] = useState(50_000);

  const symbols = useMemo(() => {
    if (useWatchlist) return watchlistSymbols;
    return manualInput
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
  }, [useWatchlist, watchlistSymbols, manualInput]);

  const { data, isLoading, error } = useOptionsFlow(symbols, minPremium);

  const sorted = useMemo(() => {
    if (!data?.length) return [];
    return [...data].sort((a, b) => b.premium - a.premium);
  }, [data]);

  return (
    <GlassCard
      title={
        <span className="flex items-center gap-1.5">
          <Zap className="w-3 h-3" />
          OPTIONS FLOW
        </span>
      }
      headerRight={
        <span className="text-[8px] font-mono text-neutral/50">
          {sorted.length} flows
        </span>
      }
      className="h-full"
    >
      {/* Controls */}
      <div className="shrink-0 px-3 py-1.5 border-b border-border/30 bg-black/20 space-y-1">
        <div className="flex items-center gap-2">
          {/* Source toggle */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setUseWatchlist(true)}
              className={`px-2 py-0.5 text-[8px] font-mono font-bold uppercase transition-all ${
                useWatchlist ? 'bg-accent/20 text-accent' : 'text-neutral/40 hover:text-white'
              }`}
            >
              Watchlist
            </button>
            <button
              onClick={() => setUseWatchlist(false)}
              className={`px-2 py-0.5 text-[8px] font-mono font-bold uppercase transition-all ${
                !useWatchlist ? 'bg-accent/20 text-accent' : 'text-neutral/40 hover:text-white'
              }`}
            >
              Manual
            </button>
          </div>

          <div className="flex-1" />

          {/* Min premium */}
          <span className="text-[8px] font-mono text-neutral/40">Min:</span>
          {MIN_PREMIUM_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setMinPremium(opt.value)}
              className={`px-1.5 py-0.5 text-[8px] font-mono font-bold transition-all ${
                minPremium === opt.value
                  ? 'bg-accent/20 text-accent'
                  : 'text-neutral/40 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Manual input */}
        {!useWatchlist && (
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value.toUpperCase())}
            placeholder="AAPL, TSLA, NVDA"
            className="w-full bg-black/40 border border-border/50 px-2 py-1 text-[10px] font-mono text-gray-200 placeholder:text-neutral/30 outline-none focus:border-accent/50"
          />
        )}
      </div>

      {/* Table header */}
      <div className="shrink-0 grid grid-cols-[50px_35px_55px_50px_50px_45px_40px_55px_40px_1fr] text-[7px] font-mono text-neutral/40 uppercase tracking-wider px-3 py-1 border-b border-border/10 bg-black/10">
        <span>Symbol</span>
        <span>Type</span>
        <span className="text-right">Strike</span>
        <span className="text-right">Expiry</span>
        <span className="text-right">Vol</span>
        <span className="text-right">OI</span>
        <span className="text-right">V/OI</span>
        <span className="text-right">Premium</span>
        <span className="text-right">IV</span>
        <span className="pl-2">Signal</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto no-scrollbar">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <div className="w-4 h-4 border-2 border-accent/30 border-t-accent animate-spin" />
            <span className="text-[10px] font-mono text-neutral/40 uppercase tracking-widest">Loading...</span>
          </div>
        )}
        {error && (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <span className="text-[10px] font-mono text-bearish/60 uppercase tracking-widest">Failed to load options flow</span>
            <button onClick={() => window.location.reload()} className="text-[9px] font-mono text-accent hover:text-white border border-accent/30 px-2 py-0.5 transition-colors">RETRY</button>
          </div>
        )}
        {!isLoading && !error && symbols.length === 0 && (
          <div className="flex items-center justify-center py-8 text-[10px] font-mono text-neutral/40 uppercase tracking-widest">
            Add symbols to track
          </div>
        )}
        {!isLoading && !error && symbols.length > 0 && sorted.length === 0 && (
          <div className="flex items-center justify-center py-8 text-[10px] font-mono text-neutral/40 uppercase tracking-widest">
            No unusual activity
          </div>
        )}
        {sorted.map((flow, i) => {
          const isCall = flow.type === 'call';
          const voiRatio = flow.openInterest > 0 ? flow.volume / flow.openInterest : 0;

          return (
            <div
              key={`${flow.symbol}-${flow.strike}-${flow.expiry}-${i}`}
              className="grid grid-cols-[50px_35px_55px_50px_50px_45px_40px_55px_40px_1fr] text-[10px] font-mono px-3 py-1.5 border-b border-border/5 hover:bg-accent/[0.04] transition-colors items-center"
            >
              <span className="font-bold text-accent">{flow.symbol}</span>
              <span className={`font-bold uppercase ${isCall ? 'text-bullish' : 'text-bearish'}`}>
                {flow.type === 'call' ? 'C' : 'P'}
              </span>
              <span className="text-right text-gray-300">${flow.strike.toFixed(0)}</span>
              <span className="text-right text-neutral/50">{formatDate(flow.expiry)}</span>
              <span className="text-right text-gray-300">{formatCompact(flow.volume)}</span>
              <span className="text-right text-neutral/50">{formatCompact(flow.openInterest)}</span>
              <span
                className={`text-right font-bold ${voiRatio > 3 ? 'text-accent' : 'text-gray-400'}`}
              >
                {voiRatio.toFixed(1)}
              </span>
              <span className="text-right font-bold text-gray-200">${formatCompact(flow.premium)}</span>
              <span className="text-right text-neutral/50">{(flow.impliedVolatility * 100).toFixed(0)}%</span>
              <span className="text-[8px] text-neutral/40 truncate pl-2">{flow.unusual}</span>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
