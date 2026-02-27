import { useEffect, useRef } from 'react';
import { createChart, type IChartApi, ColorType } from 'lightweight-charts';
import { useStockDetail } from '../../api/hooks/use-stocks';
import { useAppStore } from '../../stores/use-app-store';

function MiniChart({ symbol, onRemove }: { symbol: string; onRemove: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const { data } = useStockDetail(symbol);

  useEffect(() => {
    if (!containerRef.current || !data?.history?.length) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#000000' },
        textColor: '#cccccc',
        fontSize: 10,
        fontFamily: 'JetBrains Mono',
      },
      grid: {
        vertLines: { color: '#1a1a1a' },
        horzLines: { color: '#1a1a1a' },
      },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      crosshair: { mode: 0 },
      timeScale: { visible: false },
      rightPriceScale: { borderVisible: false },
      handleScroll: false,
      handleScale: false,
    });

    const series = chart.addCandlestickSeries({
      upColor: '#00ff00',
      downColor: '#ff0000',
      borderUpColor: '#00ff00',
      borderDownColor: '#ff0000',
      wickUpColor: '#00ff00',
      wickDownColor: '#ff0000',
    });

    series.setData(
      data.history.map((h) => ({
        time: h.time as any,
        open: h.open,
        high: h.high,
        low: h.low,
        close: h.close,
      })),
    );

    chart.timeScale().fitContent();
    chartRef.current = chart;

    const ro = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [data]);

  const q = data?.quote;
  const isUp = q && q.changePercent !== null && q.changePercent >= 0;

  return (
    <div className="flex flex-col bg-black border border-border overflow-hidden min-h-0">
      <div className="flex items-center justify-between px-2 py-1 border-b border-border shrink-0 bg-[#0a0a0a]">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-accent text-[11px]">{symbol}</span>
          {q && (
            <>
              <span className="font-mono text-white text-[10px]">{q.price.toFixed(2)}</span>
              <span className={`font-mono text-[10px] font-bold ${isUp ? 'text-bullish' : 'text-bearish'}`}>
                {isUp ? '▲' : '▼'} {Math.abs(q.changePercent || 0).toFixed(2)}%
              </span>
            </>
          )}
        </div>
        <button
          onClick={onRemove}
          className="text-neutral hover:text-bearish transition-none p-0.5 font-mono text-[10px]"
        >
          [X]
        </button>
      </div>
      <div ref={containerRef} className="flex-1 min-h-0 bg-black" />
    </div>
  );
}

export function MultiChart() {
  const compareSymbols = useAppStore((s) => s.compareSymbols);
  const removeFromCompare = useAppStore((s) => s.removeFromCompare);
  const setStockPanelView = useAppStore((s) => s.setStockPanelView);

  if (compareSymbols.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-neutral bg-black">
        <span className="text-[10px] font-mono uppercase tracking-widest font-bold">NO SYMBOLS PINNED FOR COMPARISON</span>
        <button
          onClick={() => setStockPanelView('watchlist')}
          className="text-accent text-[10px] font-mono hover:underline uppercase"
        >
          &lt; BACK TO WATCHLIST
        </button>
      </div>
    );
  }

  const gridClass = compareSymbols.length <= 2
    ? 'grid-cols-1 grid-rows-2'
    : 'grid-cols-2 grid-rows-2';

  return (
    <div className={`flex-1 grid ${gridClass} gap-[2px] min-h-0 bg-border p-[2px]`}>
      {compareSymbols.map((sym) => (
        <MiniChart
          key={sym}
          symbol={sym}
          onRemove={() => removeFromCompare(sym)}
        />
      ))}
    </div>
  );
}
