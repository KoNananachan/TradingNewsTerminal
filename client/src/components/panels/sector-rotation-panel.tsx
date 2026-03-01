import { useState, useRef, useEffect } from 'react';
import { createChart, type IChartApi, ColorType } from 'lightweight-charts';
import { GlassCard } from '../common/glass-card';
import {
  useSectorPerformance,
  useSectorRotation,
  type SectorPerformance,
  type SectorRotation,
} from '../../api/hooks/use-sectors';
import { BarChart3, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const PERIODS = ['1D', '1W', '1M', '3M'] as const;
type Period = typeof PERIODS[number];
const PERIOD_API_MAP: Record<Period, string> = { '1D': '1D', '1W': '1W', '1M': '1M', '3M': '3M' };

type View = 'heatmap' | 'rotation';

function getHeatColor(value: number): string {
  if (value > 3) return 'rgba(34,197,94,0.8)';
  if (value > 1.5) return 'rgba(34,197,94,0.5)';
  if (value > 0) return 'rgba(34,197,94,0.25)';
  if (value === 0) return 'rgba(63,63,70,0.3)';
  if (value > -1.5) return 'rgba(239,68,68,0.25)';
  if (value > -3) return 'rgba(239,68,68,0.5)';
  return 'rgba(239,68,68,0.8)';
}

function ArrowIcon({ value }: { value: number }) {
  if (value > 0) return <TrendingUp className="w-3 h-3 text-bullish" />;
  if (value < 0) return <TrendingDown className="w-3 h-3 text-bearish" />;
  return <Minus className="w-3 h-3 text-neutral" />;
}

function HeatmapView({ sectors }: { sectors: SectorPerformance[] }) {
  if (!sectors.length) {
    return (
      <div className="flex-1 flex items-center justify-center text-[10px] font-mono text-neutral/40 uppercase">
        No sector data
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto no-scrollbar p-2">
      <div className="grid grid-cols-3 gap-1">
        {sectors.map((s) => (
          <div
            key={s.symbol}
            className="p-2 border border-border/20 flex flex-col items-center justify-center min-h-[60px]"
            style={{ backgroundColor: getHeatColor(s.return) }}
          >
            <span className="text-[9px] font-mono font-black text-white uppercase tracking-wider text-center leading-tight">
              {s.name}
            </span>
            <div className="flex items-center gap-1 mt-1">
              <ArrowIcon value={s.return} />
              <span
                className={`text-[11px] font-mono font-bold ${
                  s.return >= 0 ? 'text-bullish' : 'text-bearish'
                }`}
              >
                {s.return >= 0 ? '+' : ''}
                {s.return.toFixed(2)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const QUADRANT_LABELS: Record<string, { label: string; color: string }> = {
  leading: { label: 'LEADING', color: '#22c55e' },
  weakening: { label: 'WEAKENING', color: '#fbbf24' },
  lagging: { label: 'LAGGING', color: '#ef4444' },
  improving: { label: 'IMPROVING', color: '#3b82f6' },
};

function RotationView({ sectors }: { sectors: SectorRotation[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  if (!sectors.length) {
    return (
      <div className="flex-1 flex items-center justify-center text-[10px] font-mono text-neutral/40 uppercase">
        No rotation data
      </div>
    );
  }

  // Calculate bounds
  const maxMom = Math.max(...sectors.map((s) => Math.abs(s.momentum)), 1);
  const maxAcc = Math.max(...sectors.map((s) => Math.abs(s.acceleration)), 1);

  return (
    <div className="flex-1 overflow-auto no-scrollbar p-2" ref={containerRef}>
      {/* Quadrant labels */}
      <div className="flex items-center justify-center gap-3 mb-2">
        {Object.entries(QUADRANT_LABELS).map(([key, { label, color }]) => (
          <span key={key} className="text-[8px] font-mono font-bold uppercase tracking-wider" style={{ color }}>
            {label}
          </span>
        ))}
      </div>

      {/* Scatter plot area */}
      <div className="relative w-full aspect-square max-h-[300px] mx-auto border border-border/20 bg-black/30">
        {/* Axes */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border/30" />
        <div className="absolute top-1/2 left-0 right-0 h-px bg-border/30" />

        {/* Axis labels */}
        <span className="absolute bottom-0 right-1 text-[7px] font-mono text-neutral/40">MOMENTUM +</span>
        <span className="absolute bottom-0 left-1 text-[7px] font-mono text-neutral/40">MOMENTUM -</span>
        <span className="absolute top-0 left-1 text-[7px] font-mono text-neutral/40">ACCEL +</span>

        {/* Quadrant backgrounds */}
        <div className="absolute top-0 left-1/2 right-0 bottom-1/2 bg-bullish/5" /> {/* Leading */}
        <div className="absolute top-0 left-0 right-1/2 bottom-1/2 bg-blue-500/5" /> {/* Improving */}
        <div className="absolute top-1/2 left-0 right-1/2 bottom-0 bg-bearish/5" /> {/* Lagging */}
        <div className="absolute top-1/2 left-1/2 right-0 bottom-0 bg-amber-500/5" /> {/* Weakening */}

        {/* Data points */}
        {sectors.map((s) => {
          const x = 50 + (s.momentum / maxMom) * 40;
          const y = 50 - (s.acceleration / maxAcc) * 40;
          const qColor = QUADRANT_LABELS[s.quadrant]?.color ?? '#a1a1aa';

          return (
            <div
              key={s.symbol}
              className="absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2 cursor-default group"
              style={{ left: `${x}%`, top: `${y}%` }}
              title={`${s.name}\nMomentum: ${s.momentum.toFixed(2)}\nAcceleration: ${s.acceleration.toFixed(2)}`}
            >
              <div
                className="w-3 h-3 rounded-full border-2 group-hover:scale-150 transition-transform"
                style={{ backgroundColor: qColor, borderColor: qColor }}
              />
              <span className="text-[7px] font-mono font-bold text-white mt-0.5 whitespace-nowrap">
                {s.symbol}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SectorRotationPanel() {
  const [period, setPeriod] = useState<Period>('1M');
  const [view, setView] = useState<View>('heatmap');

  const { data: perfData, isLoading: perfLoading } = useSectorPerformance(PERIOD_API_MAP[period]);
  const { data: rotData, isLoading: rotLoading } = useSectorRotation();

  const isLoading = view === 'heatmap' ? perfLoading : rotLoading;

  return (
    <GlassCard
      title={
        <span className="flex items-center gap-1.5">
          <BarChart3 className="w-3 h-3" />
          SECTOR ROTATION
        </span>
      }
      className="h-full"
    >
      {/* Controls */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-border/30 bg-black/20">
        {/* View toggle */}
        <div className="flex items-center gap-0.5">
          {(['heatmap', 'rotation'] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-2 py-0.5 text-[9px] font-mono font-black uppercase transition-all ${
                view === v
                  ? 'bg-accent/20 text-accent'
                  : 'text-neutral/50 hover:text-white'
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Period selector (only for heatmap) */}
        {view === 'heatmap' && (
          <div className="flex items-center gap-0.5">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-2 py-0.5 text-[9px] font-mono font-black transition-all ${
                  period === p
                    ? 'bg-accent/20 text-accent'
                    : 'text-neutral/50 hover:text-white'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-[10px] font-mono text-neutral/40 uppercase tracking-widest">
          Loading...
        </div>
      ) : view === 'heatmap' ? (
        <HeatmapView sectors={perfData?.sectors ?? []} />
      ) : (
        <RotationView sectors={rotData?.sectors ?? []} />
      )}
    </GlassCard>
  );
}
