import { useState, useMemo, useEffect, useRef } from 'react';
import { GlassCard } from '../common/glass-card';
import {
  useEconomicCalendar,
  useUpcomingEvents,
  type EconomicEvent,
} from '../../api/hooks/use-calendar';
import { CalendarDays } from 'lucide-react';

type ViewMode = 'calendar' | 'upcoming';

const COUNTRIES = [
  { code: 'all', label: 'ALL' },
  { code: 'US', label: 'US', flag: '\u{1F1FA}\u{1F1F8}' },
  { code: 'EU', label: 'EU', flag: '\u{1F1EA}\u{1F1FA}' },
  { code: 'JP', label: 'JP', flag: '\u{1F1EF}\u{1F1F5}' },
  { code: 'GB', label: 'GB', flag: '\u{1F1EC}\u{1F1E7}' },
  { code: 'CN', label: 'CN', flag: '\u{1F1E8}\u{1F1F3}' },
] as const;

const IMPACT_LEVELS = ['all', 'high', 'medium', 'low'] as const;

const COUNTRY_FLAGS: Record<string, string> = {
  US: '\u{1F1FA}\u{1F1F8}',
  EU: '\u{1F1EA}\u{1F1FA}',
  JP: '\u{1F1EF}\u{1F1F5}',
  GB: '\u{1F1EC}\u{1F1E7}',
  CN: '\u{1F1E8}\u{1F1F3}',
  AU: '\u{1F1E6}\u{1F1FA}',
  CA: '\u{1F1E8}\u{1F1E6}',
  CH: '\u{1F1E8}\u{1F1ED}',
  NZ: '\u{1F1F3}\u{1F1FF}',
  DE: '\u{1F1E9}\u{1F1EA}',
};

function ImpactBadge({ impact }: { impact: string }) {
  const lower = impact.toLowerCase();
  if (lower === 'high') {
    return <span className="text-[8px]" title="High Impact">{'\u{1F534}'}</span>;
  }
  if (lower === 'medium') {
    return <span className="text-[8px]" title="Medium Impact">{'\u{1F7E1}'}</span>;
  }
  return <span className="text-[8px]" title="Low Impact">{'\u{1F7E2}'}</span>;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatDateGroup(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function EventRow({ event, flash }: { event: EconomicEvent; flash: boolean }) {
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (flash && rowRef.current) {
      rowRef.current.classList.add('animate-pulse');
      const timer = setTimeout(() => {
        rowRef.current?.classList.remove('animate-pulse');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [flash, event.actual]);

  return (
    <div
      ref={rowRef}
      className={`grid grid-cols-[50px_30px_1fr_35px_60px_60px_60px] text-[10px] font-mono px-3 py-1.5 border-b border-border/5 hover:bg-accent/[0.04] transition-colors items-center ${
        event.released && event.actual ? 'bg-accent/[0.02]' : ''
      }`}
    >
      <span className="text-neutral/50">{formatTime(event.date)}</span>
      <span>{COUNTRY_FLAGS[event.country] ?? event.country}</span>
      <span className="text-gray-300 truncate pr-2">{event.event}</span>
      <span className="text-center"><ImpactBadge impact={event.impact} /></span>
      <span
        className={`text-right font-bold ${
          event.actual
            ? event.estimate && parseFloat(event.actual) > parseFloat(event.estimate)
              ? 'text-bullish'
              : event.estimate && parseFloat(event.actual) < parseFloat(event.estimate)
              ? 'text-bearish'
              : 'text-gray-300'
            : 'text-neutral/30'
        }`}
      >
        {event.actual ?? '--'}
      </span>
      <span className="text-right text-neutral/50">{event.previous ?? '--'}</span>
      <span className="text-right text-neutral/50">{event.estimate ?? '--'}</span>
    </div>
  );
}

function CalendarView() {
  const [country, setCountry] = useState<string>('all');
  const [impact, setImpact] = useState<string>('all');
  const [prevActualMap, setPrevActualMap] = useState<Record<string, string | null>>({});

  const { data: events, isLoading, error } = useEconomicCalendar(
    undefined,
    undefined,
    country === 'all' ? undefined : country,
    impact === 'all' ? undefined : impact,
  );

  // Track flashing for newly released values
  const flashIds = useMemo(() => {
    const ids = new Set<number>();
    if (events) {
      for (const e of events) {
        const prevActual = prevActualMap[e.id];
        if (prevActual === undefined && e.actual) {
          // First render with actual = no flash
        } else if (prevActual === null && e.actual) {
          ids.add(e.id);
        }
      }
    }
    return ids;
  }, [events, prevActualMap]);

  useEffect(() => {
    if (events) {
      const map: Record<string, string | null> = {};
      for (const e of events) {
        map[e.id] = e.actual;
      }
      setPrevActualMap(map);
    }
  }, [events]);

  // Group by date
  const grouped = useMemo(() => {
    if (!events?.length) return [];
    const map = new Map<string, EconomicEvent[]>();
    for (const e of events) {
      const dateKey = new Date(e.date).toDateString();
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(e);
    }
    return Array.from(map.entries());
  }, [events]);

  return (
    <>
      {/* Filters */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-1 border-b border-border/20 bg-black/10 flex-wrap">
        <span className="text-[8px] font-mono text-neutral/40 uppercase">Country:</span>
        {COUNTRIES.map((c) => (
          <button
            key={c.code}
            onClick={() => setCountry(c.code)}
            className={`px-1.5 py-0.5 text-[8px] font-mono font-bold transition-all ${
              country === c.code
                ? 'bg-accent/20 text-accent'
                : 'text-neutral/40 hover:text-white'
            }`}
          >
            {'flag' in c ? `${c.flag} ` : ''}{c.label}
          </button>
        ))}
        <span className="text-border/30">|</span>
        <span className="text-[8px] font-mono text-neutral/40 uppercase">Impact:</span>
        {IMPACT_LEVELS.map((lvl) => (
          <button
            key={lvl}
            onClick={() => setImpact(lvl)}
            className={`px-1.5 py-0.5 text-[8px] font-mono font-bold uppercase transition-all ${
              impact === lvl
                ? 'bg-accent/20 text-accent'
                : 'text-neutral/40 hover:text-white'
            }`}
          >
            {lvl}
          </button>
        ))}
      </div>

      {/* Table header */}
      <div className="shrink-0 grid grid-cols-[50px_30px_1fr_35px_60px_60px_60px] text-[8px] font-mono text-neutral/40 uppercase tracking-wider px-3 py-1 border-b border-border/10 bg-black/10">
        <span>Time</span>
        <span></span>
        <span>Event</span>
        <span className="text-center">Imp</span>
        <span className="text-right">Actual</span>
        <span className="text-right">Prev</span>
        <span className="text-right">Est</span>
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
            Failed to load calendar
          </div>
        )}
        {!isLoading && !error && grouped.length === 0 && (
          <div className="flex items-center justify-center py-8 text-[10px] font-mono text-neutral/40 uppercase tracking-widest">
            No events
          </div>
        )}
        {grouped.map(([dateKey, evts]) => (
          <div key={dateKey}>
            <div className="sticky top-0 z-10 px-3 py-1 text-[9px] font-mono font-black uppercase tracking-widest bg-black/40 text-neutral/60 border-b border-border/20">
              {formatDateGroup(evts[0].date)}
            </div>
            {evts.map((e) => (
              <EventRow key={e.id} event={e} flash={flashIds.has(e.id)} />
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

function UpcomingView() {
  const { data: events, isLoading, error } = useUpcomingEvents();

  return (
    <>
      {/* Table header */}
      <div className="shrink-0 grid grid-cols-[50px_30px_1fr_35px_60px_60px_60px] text-[8px] font-mono text-neutral/40 uppercase tracking-wider px-3 py-1 border-b border-border/10 bg-black/10">
        <span>Time</span>
        <span></span>
        <span>Event</span>
        <span className="text-center">Imp</span>
        <span className="text-right">Actual</span>
        <span className="text-right">Prev</span>
        <span className="text-right">Est</span>
      </div>

      <div className="flex-1 overflow-auto no-scrollbar">
        {isLoading && (
          <div className="flex items-center justify-center py-8 text-[10px] font-mono text-neutral/40 uppercase tracking-widest">
            Loading...
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center py-8 text-[10px] font-mono text-bearish/60 uppercase tracking-widest">
            Failed to load events
          </div>
        )}
        {!isLoading && !error && (!events || events.length === 0) && (
          <div className="flex items-center justify-center py-8 text-[10px] font-mono text-neutral/40 uppercase tracking-widest">
            No upcoming events
          </div>
        )}
        {events?.map((e) => (
          <EventRow key={e.id} event={e} flash={false} />
        ))}
      </div>
    </>
  );
}

export function EconomicCalendarPanel() {
  const [view, setView] = useState<ViewMode>('calendar');

  return (
    <GlassCard
      title={
        <span className="flex items-center gap-1.5">
          <CalendarDays className="w-3 h-3" />
          ECONOMIC CALENDAR
        </span>
      }
      className="h-full"
    >
      {/* View toggle */}
      <div className="shrink-0 flex items-center border-b border-border/30 bg-black/20">
        {(['calendar', 'upcoming'] as ViewMode[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-1.5 text-[9px] font-mono font-black uppercase tracking-widest border-b-2 transition-all ${
              view === v
                ? 'border-accent text-accent'
                : 'border-transparent text-neutral/50 hover:text-gray-300'
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {view === 'calendar' ? <CalendarView /> : <UpcomingView />}
    </GlassCard>
  );
}
