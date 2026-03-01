import { useState, useMemo } from 'react';
import { GlassCard } from '../common/glass-card';
import { useEarningsCalendar, type EarningsEntry } from '../../api/hooks/use-earnings';
import { useAppStore } from '../../stores/use-app-store';
import { Calendar } from 'lucide-react';

const DAYS_OPTIONS = [7, 14, 30] as const;

function formatCompact(n: number | null | undefined): string {
  if (n == null) return '--';
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(2);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' });
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

export function EarningsCalendarPanel() {
  const [days, setDays] = useState<number>(14);
  const { data, isLoading, error } = useEarningsCalendar(days);
  const setSelectedSymbol = useAppStore((s) => s.setSelectedSymbol);

  // Group by date
  const grouped = useMemo(() => {
    if (!data?.length) return [];
    const map = new Map<string, EarningsEntry[]>();
    for (const entry of data) {
      const dateKey = entry.earningsDate ?? 'Unknown';
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(entry);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [data]);

  return (
    <GlassCard
      title={
        <span className="flex items-center gap-1.5">
          <Calendar className="w-3 h-3" />
          EARNINGS CALENDAR
        </span>
      }
      headerRight={
        <span className="text-[8px] font-mono text-neutral/50">
          {data?.length ?? 0} events
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

      {/* Content */}
      <div className="flex-1 overflow-auto no-scrollbar">
        {isLoading && (
          <div className="flex items-center justify-center py-8 text-[10px] font-mono text-neutral/40 uppercase tracking-widest">
            Loading...
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center py-8 text-[10px] font-mono text-bearish/60 uppercase tracking-widest">
            Failed to load earnings
          </div>
        )}
        {!isLoading && !error && grouped.length === 0 && (
          <div className="flex items-center justify-center py-8 text-[10px] font-mono text-neutral/40 uppercase tracking-widest">
            No upcoming earnings
          </div>
        )}

        {grouped.map(([dateKey, entries]) => {
          const today = isToday(dateKey);
          return (
            <div key={dateKey}>
              {/* Date header */}
              <div
                className={`sticky top-0 z-10 px-3 py-1 text-[9px] font-mono font-black uppercase tracking-widest border-b border-border/20 ${
                  today
                    ? 'bg-accent/10 text-accent border-accent/30'
                    : 'bg-black/40 text-neutral/60'
                }`}
              >
                {dateKey !== 'Unknown' ? formatDate(dateKey) : 'TBD'}
                {today && (
                  <span className="ml-2 px-1 py-0.5 text-[7px] bg-accent/20 text-accent border border-accent/30">
                    TODAY
                  </span>
                )}
              </div>

              {/* Table header */}
              <div className="grid grid-cols-[60px_1fr_70px_70px_80px] text-[8px] font-mono text-neutral/40 uppercase tracking-wider px-3 py-1 border-b border-border/10 bg-black/10">
                <span>Symbol</span>
                <span>Company</span>
                <span className="text-right">EPS Est.</span>
                <span className="text-right">EPS Act.</span>
                <span className="text-right">Rev Est.</span>
              </div>

              {/* Rows */}
              {entries.map((entry, i) => {
                const beat =
                  entry.epsActual != null && entry.epsEstimate != null
                    ? entry.epsActual > entry.epsEstimate
                    : null;

                return (
                  <button
                    key={`${entry.symbol}-${i}`}
                    onClick={() => setSelectedSymbol(entry.symbol)}
                    className={`w-full grid grid-cols-[60px_1fr_70px_70px_80px] text-[10px] font-mono px-3 py-1.5 border-b border-border/5 hover:bg-accent/[0.04] transition-colors text-left ${
                      today ? 'bg-accent/[0.02]' : ''
                    }`}
                  >
                    <span className="font-black text-accent">{entry.symbol}</span>
                    <span className="text-gray-400 truncate pr-2">{entry.name ?? '--'}</span>
                    <span className="text-right text-gray-300">
                      {entry.epsEstimate != null ? `$${entry.epsEstimate.toFixed(2)}` : '--'}
                    </span>
                    <span
                      className={`text-right font-bold ${
                        beat === true
                          ? 'text-bullish'
                          : beat === false
                          ? 'text-bearish'
                          : 'text-gray-300'
                      }`}
                    >
                      {entry.epsActual != null ? `$${entry.epsActual.toFixed(2)}` : '--'}
                    </span>
                    <span className="text-right text-gray-400">
                      {formatCompact(entry.revenueEstimate)}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
