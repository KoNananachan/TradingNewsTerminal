import { useState, useRef, useEffect } from 'react';
import { createChart, type IChartApi, ColorType } from 'lightweight-charts';
import { GlassCard } from '../common/glass-card';
import { useSentimentTrend } from '../../api/hooks/use-sentiment';
import { useAppStore } from '../../stores/use-app-store';
import { Activity } from 'lucide-react';

const SCOPES = ['ticker', 'category', 'market'] as const;
type Scope = typeof SCOPES[number];
const WINDOWS = ['1D', '1W', '1M'] as const;
type Window = typeof WINDOWS[number];

export function SentimentPanel() {
  const selectedSymbol = useAppStore((s) => s.selectedSymbol);
  const [scope, setScope] = useState<Scope>('ticker');
  const [value, setValue] = useState(selectedSymbol ?? '');
  const [window, setWindow] = useState<Window>('1W');
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  // Sync with selectedSymbol
  useEffect(() => {
    if (selectedSymbol && scope === 'ticker') {
      setValue(selectedSymbol);
    }
  }, [selectedSymbol, scope]);

  const { data, isLoading, error } = useSentimentTrend(scope, value, window);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    if (!data?.buckets?.length) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#a1a1aa',
        fontSize: 10,
        fontFamily: 'ui-monospace, monospace',
      },
      grid: {
        vertLines: { color: 'rgba(63,63,70,0.1)' },
        horzLines: { color: 'rgba(63,63,70,0.1)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      crosshair: {
        horzLine: { color: '#fbbf24', labelBackgroundColor: '#fbbf24' },
        vertLine: { color: '#fbbf24', labelBackgroundColor: '#fbbf24' },
      },
      rightPriceScale: { borderColor: 'rgba(63,63,70,0.3)' },
      timeScale: { borderColor: 'rgba(63,63,70,0.3)' },
    });

    const areaSeries = chart.addAreaSeries({
      topColor: 'rgba(34,197,94,0.4)',
      bottomColor: 'rgba(239,68,68,0.4)',
      lineColor: '#fbbf24',
      lineWidth: 2,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      priceLineVisible: false,
    });

    // Baseline at 0
    const baselineSeries = chart.addLineSeries({
      color: 'rgba(161,161,170,0.3)',
      lineWidth: 1,
      lineStyle: 2, // dashed
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    const chartData = data.buckets.map((b) => ({
      time: b.time as unknown as number,
      value: b.avgScore,
    }));

    areaSeries.setData(chartData as any);

    if (chartData.length >= 2) {
      baselineSeries.setData([
        { time: chartData[0].time, value: 0 },
        { time: chartData[chartData.length - 1].time, value: 0 },
      ] as any);
    }

    chart.timeScale().fitContent();
    chartRef.current = chart;

    const ro = new ResizeObserver(() => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    });
    ro.observe(chartContainerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [data]);

  return (
    <GlassCard
      title={
        <span className="flex items-center gap-1.5">
          <Activity className="w-3 h-3" />
          SENTIMENT TREND
        </span>
      }
      headerRight={
        data?.reversal ? (
          <span className="px-1.5 py-0.5 text-[8px] font-mono font-black uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
            REVERSAL
          </span>
        ) : null
      }
      className="h-full"
    >
      {/* Controls */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-border/30 bg-black/20">
        {/* Scope selector */}
        <div className="flex items-center gap-0.5">
          {SCOPES.map((s) => (
            <button
              key={s}
              onClick={() => {
                setScope(s);
                if (s === 'ticker') setValue(selectedSymbol ?? '');
                else if (s === 'market') setValue('US');
                else setValue('');
              }}
              className={`px-2 py-0.5 text-[9px] font-mono font-black uppercase transition-all ${
                scope === s
                  ? 'bg-accent/20 text-accent'
                  : 'text-neutral/50 hover:text-white'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Value input */}
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
          placeholder={scope === 'ticker' ? 'AAPL' : scope === 'category' ? 'Tech' : 'US'}
          className="flex-1 min-w-0 bg-black/40 border border-border/50 px-2 py-0.5 text-[10px] font-mono text-gray-200 placeholder:text-neutral/30 outline-none focus:border-accent/50"
        />

        {/* Window selector */}
        <div className="flex items-center gap-0.5">
          {WINDOWS.map((w) => (
            <button
              key={w}
              onClick={() => setWindow(w)}
              className={`px-2 py-0.5 text-[9px] font-mono font-black transition-all ${
                window === w
                  ? 'bg-accent/20 text-accent'
                  : 'text-neutral/50 hover:text-white'
              }`}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-neutral/40 uppercase tracking-widest z-10">
            Loading...
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-bearish/60 uppercase tracking-widest z-10">
            Failed to load sentiment data
          </div>
        )}
        {!isLoading && !error && !data?.buckets?.length && value && (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-neutral/40 uppercase tracking-widest z-10">
            No sentiment data
          </div>
        )}
        {!value && (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-neutral/40 uppercase tracking-widest z-10">
            Enter a value to track
          </div>
        )}
        <div ref={chartContainerRef} className="w-full h-full" />
      </div>
    </GlassCard>
  );
}
