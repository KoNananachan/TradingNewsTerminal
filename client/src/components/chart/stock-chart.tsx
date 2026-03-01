import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type SeriesType,
  ColorType,
  type MouseEventParams,
  type LogicalRange,
} from 'lightweight-charts';
import { useStockDetail } from '../../api/hooks/use-stocks';
import { useAppStore } from '../../stores/use-app-store';
import { sma, ema } from '../../lib/indicators';
import { rsi } from '../../lib/indicators/rsi';
import { macd } from '../../lib/indicators/macd';
import { IndicatorToolbar } from './indicator-toolbar';

const RANGE_OPTIONS = ['1D', '5D', '1M', '3M', '6M', '1Y', 'ALL'] as const;
type RangeOption = (typeof RANGE_OPTIONS)[number];

const RANGE_API_MAP: Record<RangeOption, string> = {
  '1D': '1d',
  '5D': '5d',
  '1M': '1mo',
  '3M': '3mo',
  '6M': '6mo',
  '1Y': '1y',
  ALL: 'max',
};

const INTRADAY_RANGES = new Set(['1D', '5D', '1M']);

const CHART_OPTIONS_BASE = {
  layout: {
    background: { type: ColorType.Solid as const, color: 'transparent' },
    textColor: '#a1a1aa',
    fontSize: 10,
    fontFamily: 'ui-monospace, monospace',
  },
  grid: {
    vertLines: { color: 'rgba(63,63,70,0.1)' },
    horzLines: { color: 'rgba(63,63,70,0.1)' },
  },
  crosshair: {
    horzLine: { color: '#22c55e', labelBackgroundColor: '#22c55e' },
    vertLine: { color: '#22c55e', labelBackgroundColor: '#22c55e' },
  },
  rightPriceScale: { borderColor: 'rgba(63,63,70,0.3)' },
  timeScale: { borderColor: 'rgba(63,63,70,0.3)' },
};

// Bollinger Bands calculation
function bollingerBands(
  closes: number[],
  period: number = 20,
  multiplier: number = 2,
): { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] } {
  const middle = sma(closes, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (middle[i] === null || i < period - 1) {
      upper.push(null);
      lower.push(null);
      continue;
    }
    let variance = 0;
    for (let j = i - period + 1; j <= i; j++) {
      variance += (closes[j] - middle[i]!) ** 2;
    }
    const std = Math.sqrt(variance / period);
    upper.push(middle[i]! + multiplier * std);
    lower.push(middle[i]! - multiplier * std);
  }

  return { upper, middle, lower };
}

// ATR calculation
function calcATR(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14,
): (number | null)[] {
  const result: (number | null)[] = [null];

  for (let i = 1; i < closes.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1]),
    );
    if (i < period) {
      result.push(null);
    } else if (i === period) {
      let sum = 0;
      for (let j = 1; j <= period; j++) {
        sum += Math.max(
          highs[j] - lows[j],
          Math.abs(highs[j] - closes[j - 1]),
          Math.abs(lows[j] - closes[j - 1]),
        );
      }
      result.push(sum / period);
    } else {
      const prevATR = result[i - 1]!;
      result.push((prevATR * (period - 1) + tr) / period);
    }
  }

  return result;
}

interface StockChartProps {
  symbol: string;
  range: string;
  onRangeChange: (r: string) => void;
}

export function StockChart({ symbol, range, onRangeChange }: StockChartProps) {
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const rsiContainerRef = useRef<HTMLDivElement>(null);
  const macdContainerRef = useRef<HTMLDivElement>(null);

  const mainChartRef = useRef<IChartApi | null>(null);
  const rsiChartRef = useRef<IChartApi | null>(null);
  const macdChartRef = useRef<IChartApi | null>(null);

  const drawingPointsRef = useRef<Array<{ time: number; price: number }>>([]);

  const indicatorConfig = useAppStore((s) => s.indicatorConfig);
  const activeDrawingTool = useAppStore((s) => s.activeDrawingTool);
  const addChartDrawing = useAppStore((s) => s.addChartDrawing);
  const setActiveDrawingTool = useAppStore((s) => s.setActiveDrawingTool);
  const chartDrawings = useAppStore((s) => s.chartDrawings);

  const rangeKey = range as RangeOption;
  const apiRange = RANGE_API_MAP[rangeKey] ?? range;
  const { data } = useStockDetail(symbol, { range: apiRange });
  const isIntraday = INTRADAY_RANGES.has(rangeKey);

  const showRSI = !!indicatorConfig['rsi'];
  const showMACD = !!indicatorConfig['macd'];
  const showBB = !!indicatorConfig['bb'];
  const showATR = !!indicatorConfig['atr'];
  const showVWAP = !!indicatorConfig['vwap'];

  // Build main chart
  useEffect(() => {
    if (!mainContainerRef.current || !data?.history?.length) return;

    // Cleanup previous
    if (mainChartRef.current) {
      mainChartRef.current.remove();
      mainChartRef.current = null;
    }

    const container = mainContainerRef.current;
    const chart = createChart(container, {
      ...CHART_OPTIONS_BASE,
      width: container.clientWidth,
      height: container.clientHeight,
    });

    const validHistory = data.history.filter(
      (h) => h.open != null && h.high != null && h.low != null && h.close != null,
    );

    if (validHistory.length === 0) {
      chart.remove();
      return;
    }

    // Candlestick
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e88',
      wickDownColor: '#ef444488',
    });

    candleSeries.setData(
      validHistory.map((h) => ({
        time: h.time as any,
        open: h.open,
        high: h.high,
        low: h.low,
        close: h.close,
      })),
    );

    // Volume histogram
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });

    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    volumeSeries.setData(
      validHistory.map((h) => ({
        time: h.time as any,
        value: h.volume ?? 0,
        color:
          (h.close ?? 0) >= (h.open ?? 0)
            ? 'rgba(34,197,94,0.3)'
            : 'rgba(239,68,68,0.3)',
      })),
    );

    const closes = validHistory.map((h) => h.close);
    const highs = validHistory.map((h) => h.high);
    const lows = validHistory.map((h) => h.low);

    // SMA overlays (always on for daily+)
    if (!isIntraday && validHistory.length >= 20 && indicatorConfig['sma20'] !== false) {
      const sma20Data = sma(closes, 20);
      const sma20Series = chart.addLineSeries({
        color: '#3b82f6',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
        title: 'SMA20',
      });
      sma20Series.setData(
        validHistory
          .map((h, i) => ({ time: h.time as any, value: sma20Data[i]! }))
          .filter((p) => p.value != null),
      );
    }

    if (!isIntraday && validHistory.length >= 50 && indicatorConfig['sma50'] !== false) {
      const sma50Data = sma(closes, 50);
      const sma50Series = chart.addLineSeries({
        color: '#f97316',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
        title: 'SMA50',
      });
      sma50Series.setData(
        validHistory
          .map((h, i) => ({ time: h.time as any, value: sma50Data[i]! }))
          .filter((p) => p.value != null),
      );
    }

    // Bollinger Bands
    if (showBB && validHistory.length >= 20) {
      const bb = bollingerBands(closes);

      const bbUpperSeries = chart.addLineSeries({
        color: 'rgba(147,51,234,0.5)',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
        title: 'BB+',
      });
      bbUpperSeries.setData(
        validHistory
          .map((h, i) => ({ time: h.time as any, value: bb.upper[i]! }))
          .filter((p) => p.value != null),
      );

      const bbLowerSeries = chart.addLineSeries({
        color: 'rgba(147,51,234,0.5)',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
        title: 'BB-',
      });
      bbLowerSeries.setData(
        validHistory
          .map((h, i) => ({ time: h.time as any, value: bb.lower[i]! }))
          .filter((p) => p.value != null),
      );

      const bbMidSeries = chart.addLineSeries({
        color: 'rgba(147,51,234,0.3)',
        lineWidth: 1,
        lineStyle: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      bbMidSeries.setData(
        validHistory
          .map((h, i) => ({ time: h.time as any, value: bb.middle[i]! }))
          .filter((p) => p.value != null),
      );
    }

    // VWAP (approximate: cumulative (price*volume) / cumulative volume)
    if (showVWAP && validHistory.length > 0) {
      let cumPV = 0;
      let cumVol = 0;
      const vwapData: Array<{ time: any; value: number }> = [];
      for (let i = 0; i < validHistory.length; i++) {
        const typical = (validHistory[i].high + validHistory[i].low + validHistory[i].close) / 3;
        const vol = validHistory[i].volume ?? 0;
        cumPV += typical * vol;
        cumVol += vol;
        if (cumVol > 0) {
          vwapData.push({ time: validHistory[i].time as any, value: cumPV / cumVol });
        }
      }
      if (vwapData.length > 0) {
        const vwapSeries = chart.addLineSeries({
          color: '#06b6d4',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
          title: 'VWAP',
        });
        vwapSeries.setData(vwapData);
      }
    }

    // Draw existing drawings
    for (const drawing of chartDrawings) {
      drawOnChart(chart, candleSeries, drawing);
    }

    // Handle drawing tool clicks
    const clickHandler = (param: MouseEventParams) => {
      if (!activeDrawingTool || !param.time) return;

      const price = candleSeries.coordinateToPrice(param.point?.y ?? 0);
      if (price === null) return;

      const point = { time: param.time as number, price: price as number };
      drawingPointsRef.current.push(point);

      if (activeDrawingTool === 'hline') {
        // 1 click
        const drawing = { type: 'hline', points: [point] };
        addChartDrawing(drawing);
        drawOnChart(chart, candleSeries, drawing);
        drawingPointsRef.current = [];
        setActiveDrawingTool(null);
      } else if (
        (activeDrawingTool === 'trendline' || activeDrawingTool === 'fibonacci') &&
        drawingPointsRef.current.length >= 2
      ) {
        // 2 clicks
        const drawing = { type: activeDrawingTool, points: [...drawingPointsRef.current] };
        addChartDrawing(drawing);
        drawOnChart(chart, candleSeries, drawing);
        drawingPointsRef.current = [];
        setActiveDrawingTool(null);
      }
    };

    chart.subscribeClick(clickHandler);
    chart.timeScale().fitContent();
    mainChartRef.current = chart;

    const ro = new ResizeObserver(() => {
      if (container && mainChartRef.current) {
        mainChartRef.current.applyOptions({
          width: container.clientWidth,
          height: container.clientHeight,
        });
      }
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      chart.unsubscribeClick(clickHandler);
      chart.remove();
      mainChartRef.current = null;
    };
  }, [data, rangeKey, showBB, showVWAP, indicatorConfig, chartDrawings]);

  // Build RSI sub-chart
  useEffect(() => {
    if (!rsiContainerRef.current) return;
    if (rsiChartRef.current) {
      rsiChartRef.current.remove();
      rsiChartRef.current = null;
    }
    if (!showRSI || !data?.history?.length) return;

    const container = rsiContainerRef.current;
    const chart = createChart(container, {
      ...CHART_OPTIONS_BASE,
      width: container.clientWidth,
      height: container.clientHeight,
      rightPriceScale: {
        borderColor: 'rgba(63,63,70,0.3)',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
    });

    const validHistory = data.history.filter((h) => h.close != null);
    const closes = validHistory.map((h) => h.close);
    const rsiData = rsi(closes, 14);

    const rsiSeries = chart.addLineSeries({
      color: '#f59e0b',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'RSI',
    });

    rsiSeries.setData(
      validHistory
        .map((h, i) => ({ time: h.time as any, value: rsiData[i]! }))
        .filter((p) => p.value != null),
    );

    // Overbought/oversold lines
    const ob = chart.addLineSeries({
      color: 'rgba(239,68,68,0.3)',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    const os = chart.addLineSeries({
      color: 'rgba(34,197,94,0.3)',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    if (validHistory.length >= 2) {
      const first = validHistory[0].time as any;
      const last = validHistory[validHistory.length - 1].time as any;
      ob.setData([
        { time: first, value: 70 },
        { time: last, value: 70 },
      ]);
      os.setData([
        { time: first, value: 30 },
        { time: last, value: 30 },
      ]);
    }

    chart.timeScale().fitContent();
    rsiChartRef.current = chart;

    // Sync time axis with main chart
    if (mainChartRef.current) {
      mainChartRef.current.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (range && rsiChartRef.current) {
          rsiChartRef.current.timeScale().setVisibleLogicalRange(range);
        }
      });
      chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (range && mainChartRef.current) {
          mainChartRef.current.timeScale().setVisibleLogicalRange(range);
        }
      });
    }

    const ro = new ResizeObserver(() => {
      if (container && rsiChartRef.current) {
        rsiChartRef.current.applyOptions({
          width: container.clientWidth,
          height: container.clientHeight,
        });
      }
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      chart.remove();
      rsiChartRef.current = null;
    };
  }, [data, showRSI]);

  // Build MACD sub-chart
  useEffect(() => {
    if (!macdContainerRef.current) return;
    if (macdChartRef.current) {
      macdChartRef.current.remove();
      macdChartRef.current = null;
    }
    if (!showMACD || !data?.history?.length) return;

    const container = macdContainerRef.current;
    const chart = createChart(container, {
      ...CHART_OPTIONS_BASE,
      width: container.clientWidth,
      height: container.clientHeight,
    });

    const validHistory = data.history.filter((h) => h.close != null);
    const closes = validHistory.map((h) => h.close);
    const macdResult = macd(closes);

    const macdLineSeries = chart.addLineSeries({
      color: '#3b82f6',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'MACD',
    });
    macdLineSeries.setData(
      validHistory
        .map((h, i) => ({ time: h.time as any, value: macdResult.macd[i]! }))
        .filter((p) => p.value != null),
    );

    const signalSeries = chart.addLineSeries({
      color: '#f97316',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      title: 'Signal',
    });
    signalSeries.setData(
      validHistory
        .map((h, i) => ({ time: h.time as any, value: macdResult.signal[i]! }))
        .filter((p) => p.value != null),
    );

    const histSeries = chart.addHistogramSeries({
      priceScaleId: 'macd_hist',
    });
    chart.priceScale('macd_hist').applyOptions({
      scaleMargins: { top: 0.6, bottom: 0 },
    });
    histSeries.setData(
      validHistory
        .map((h, i) => ({
          time: h.time as any,
          value: macdResult.histogram[i]!,
          color:
            macdResult.histogram[i] != null
              ? macdResult.histogram[i]! >= 0
                ? 'rgba(34,197,94,0.5)'
                : 'rgba(239,68,68,0.5)'
              : 'transparent',
        }))
        .filter((p) => p.value != null),
    );

    chart.timeScale().fitContent();
    macdChartRef.current = chart;

    // Sync time axis with main chart
    if (mainChartRef.current) {
      mainChartRef.current.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (range && macdChartRef.current) {
          macdChartRef.current.timeScale().setVisibleLogicalRange(range);
        }
      });
      chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (range && mainChartRef.current) {
          mainChartRef.current.timeScale().setVisibleLogicalRange(range);
        }
      });
    }

    const ro = new ResizeObserver(() => {
      if (container && macdChartRef.current) {
        macdChartRef.current.applyOptions({
          width: container.clientWidth,
          height: container.clientHeight,
        });
      }
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      chart.remove();
      macdChartRef.current = null;
    };
  }, [data, showMACD]);

  // ATR indicator legend (shown as an overlay on main chart)
  const atrValue = (() => {
    if (!showATR || !data?.history?.length) return null;
    const validHistory = data.history.filter(
      (h) => h.high != null && h.low != null && h.close != null,
    );
    if (validHistory.length < 15) return null;
    const highs = validHistory.map((h) => h.high);
    const lows = validHistory.map((h) => h.low);
    const closes = validHistory.map((h) => h.close);
    const atrData = calcATR(highs, lows, closes);
    const last = atrData[atrData.length - 1];
    return last;
  })();

  // Calculate main chart flex based on active sub-charts
  const subChartCount = (showRSI ? 1 : 0) + (showMACD ? 1 : 0);

  return (
    <div className="flex flex-col h-full">
      {/* Indicator toolbar */}
      <IndicatorToolbar />

      {/* Range selector */}
      <div className="shrink-0 flex items-center gap-0.5 px-3 py-1 bg-black/10 border-b border-border/20">
        {RANGE_OPTIONS.map((r) => (
          <button
            key={r}
            onClick={() => onRangeChange(r)}
            className={`px-2 py-0.5 text-[9px] font-mono font-black transition-all ${
              rangeKey === r
                ? 'bg-accent/20 text-accent'
                : 'text-neutral/50 hover:text-white'
            }`}
          >
            {r}
          </button>
        ))}

        {/* SMA legend */}
        {!isIntraday && (
          <div className="ml-auto flex items-center gap-3 text-[8px] font-mono text-neutral/50">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-0.5 bg-blue-500 inline-block" />
              SMA20
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-0.5 bg-orange-500 inline-block" />
              SMA50
            </span>
            {showBB && (
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-0.5 bg-purple-500 inline-block" />
                BB
              </span>
            )}
            {showVWAP && (
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-0.5 bg-cyan-500 inline-block" />
                VWAP
              </span>
            )}
          </div>
        )}
      </div>

      {/* Active drawing tool indicator */}
      {activeDrawingTool && (
        <div className="shrink-0 px-3 py-0.5 bg-accent/10 text-[8px] font-mono text-accent border-b border-accent/20">
          Drawing: {activeDrawingTool.toUpperCase()} - Click on chart to place points ({activeDrawingTool === 'hline' ? '1 click' : '2 clicks'})
        </div>
      )}

      {/* ATR overlay */}
      {showATR && atrValue != null && (
        <div className="shrink-0 px-3 py-0.5 bg-black/10 text-[8px] font-mono text-neutral/50 border-b border-border/10">
          ATR(14): <span className="text-accent font-bold">{atrValue.toFixed(2)}</span>
        </div>
      )}

      {/* Main chart */}
      <div
        ref={mainContainerRef}
        className="min-h-0 w-full"
        style={{ flex: subChartCount === 0 ? '1' : subChartCount === 1 ? '3' : '2' }}
      />

      {/* RSI sub-chart */}
      {showRSI && (
        <>
          <div className="shrink-0 px-3 py-0.5 bg-black/20 text-[8px] font-mono text-neutral/40 border-y border-border/20">
            RSI (14) - <span className="text-amber-400">Overbought 70</span> / <span className="text-green-400">Oversold 30</span>
          </div>
          <div ref={rsiContainerRef} className="w-full" style={{ flex: '1' }} />
        </>
      )}

      {/* MACD sub-chart */}
      {showMACD && (
        <>
          <div className="shrink-0 px-3 py-0.5 bg-black/20 text-[8px] font-mono text-neutral/40 border-y border-border/20">
            MACD (12, 26, 9) - <span className="text-blue-400">MACD</span> / <span className="text-orange-400">Signal</span>
          </div>
          <div ref={macdContainerRef} className="w-full" style={{ flex: '1' }} />
        </>
      )}
    </div>
  );
}

// Draw lines/fib on chart
function drawOnChart(
  chart: IChartApi,
  priceSeries: ISeriesApi<'Candlestick'>,
  drawing: { type: string; points: Array<{ time: number; price: number }> },
) {
  const { type, points } = drawing;

  if (type === 'hline' && points.length >= 1) {
    // Horizontal line - add a price line to the series
    priceSeries.createPriceLine({
      price: points[0].price,
      color: '#fbbf24',
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: '',
    });
  }

  if (type === 'trendline' && points.length >= 2) {
    const lineSeries = chart.addLineSeries({
      color: '#fbbf24',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    lineSeries.setData(
      points.map((p) => ({ time: p.time as any, value: p.price })),
    );
  }

  if (type === 'fibonacci' && points.length >= 2) {
    const high = Math.max(points[0].price, points[1].price);
    const low = Math.min(points[0].price, points[1].price);
    const diff = high - low;
    const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
    const colors = ['#ef4444', '#f97316', '#fbbf24', '#a3a3a3', '#22c55e', '#3b82f6', '#8b5cf6'];

    for (let i = 0; i < levels.length; i++) {
      const price = high - diff * levels[i];
      priceSeries.createPriceLine({
        price,
        color: colors[i],
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: `${(levels[i] * 100).toFixed(1)}%`,
      });
    }
  }
}
