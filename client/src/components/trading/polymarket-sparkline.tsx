import { useMemo } from 'react';
import { useCLOBPriceHistory } from '../../hooks/use-polymarket';

interface PolymarketSparklineProps {
  conditionId: string;
  width?: number;
  height?: number;
}

export function PolymarketSparkline({ conditionId, width = 80, height = 16 }: PolymarketSparklineProps) {
  const { data: history } = useCLOBPriceHistory(conditionId, '1w');

  const pathD = useMemo(() => {
    if (!history || !Array.isArray(history) || history.length < 2) return null;

    // history is an array of {t, p} points
    const points = history.map(h => ({
      t: typeof h.t === 'number' ? h.t : 0,
      p: typeof h.p === 'number' ? h.p : 0,
    })).filter(p => p.p > 0);

    if (points.length < 2) return null;

    const minP = Math.min(...points.map(p => p.p));
    const maxP = Math.max(...points.map(p => p.p));
    const range = maxP - minP || 0.01;
    const pad = 1;

    const coords = points.map((p, i) => ({
      x: pad + (i / (points.length - 1)) * (width - pad * 2),
      y: pad + (1 - (p.p - minP) / range) * (height - pad * 2),
    }));

    return coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  }, [history, width, height]);

  if (!pathD) return null;

  // Determine trend color based on first vs last price
  const firstPrice = history && history.length > 1 ? (history[0]?.p ?? 0) : 0;
  const lastPrice = history && history.length > 1 ? (history[history.length - 1]?.p ?? 0) : 0;
  const color = lastPrice >= firstPrice ? '#22c55e' : '#ef4444';

  return (
    <svg width={width} height={height} className="block">
      <path d={pathD} fill="none" stroke={color} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
    </svg>
  );
}
