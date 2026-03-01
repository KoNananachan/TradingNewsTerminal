import { useState } from 'react';
import { GlassCard } from '../common/glass-card';
import { useCorrelationMatrix } from '../../api/hooks/use-correlations';
import { Grid3X3 } from 'lucide-react';

const PERIODS = ['1M', '3M', '6M', '1Y'] as const;
type Period = typeof PERIODS[number];

function getCellColor(value: number, isDiagonal: boolean): string {
  if (isDiagonal) return 'rgba(63,63,70,0.3)';
  // blue (-1) -> white (0) -> red (+1)
  if (value > 0) {
    const intensity = Math.min(value, 1);
    return `rgba(239,68,68,${intensity * 0.6})`;
  }
  if (value < 0) {
    const intensity = Math.min(Math.abs(value), 1);
    return `rgba(59,130,246,${intensity * 0.6})`;
  }
  return 'transparent';
}

function getTextColor(value: number): string {
  const abs = Math.abs(value);
  if (abs > 0.7) return '#ffffff';
  if (abs > 0.4) return '#e4e4e7';
  return '#a1a1aa';
}

export function CorrelationMatrixPanel() {
  const [period, setPeriod] = useState<Period>('3M');
  const { data, isLoading, error } = useCorrelationMatrix(period);

  return (
    <GlassCard
      title={
        <span className="flex items-center gap-1.5">
          <Grid3X3 className="w-3 h-3" />
          CORRELATION MATRIX
        </span>
      }
      className="h-full"
    >
      {/* Period selector */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-border/30 bg-black/20">
        <span className="text-[8px] font-mono text-neutral/50 uppercase">Period:</span>
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
      </div>

      {/* Matrix */}
      <div className="flex-1 overflow-auto no-scrollbar p-2">
        {isLoading && (
          <div className="flex items-center justify-center py-8 text-[10px] font-mono text-neutral/40 uppercase tracking-widest">
            Loading...
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center py-8 text-[10px] font-mono text-bearish/60 uppercase tracking-widest">
            Failed to load data
          </div>
        )}
        {!isLoading && !error && data && (
          <div className="overflow-auto">
            <table className="border-collapse w-full">
              <thead>
                <tr>
                  {/* Empty corner cell */}
                  <th className="p-1 text-[8px] font-mono text-neutral/30 w-12" />
                  {data.symbols.map((sym, i) => (
                    <th
                      key={sym}
                      className="p-1 text-[8px] font-mono font-bold text-accent uppercase tracking-wider whitespace-nowrap"
                      title={data.names[i]}
                    >
                      {sym}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.matrix.map((row, i) => (
                  <tr key={data.symbols[i]}>
                    <td className="p-1 text-[8px] font-mono font-bold text-accent uppercase tracking-wider whitespace-nowrap">
                      {data.symbols[i]}
                    </td>
                    {row.map((val, j) => {
                      const isDiagonal = i === j;
                      return (
                        <td
                          key={j}
                          className="p-1 text-center border border-border/10"
                          style={{ backgroundColor: getCellColor(val, isDiagonal) }}
                        >
                          <span
                            className="text-[9px] font-mono font-bold"
                            style={{ color: isDiagonal ? '#71717a' : getTextColor(val) }}
                          >
                            {val.toFixed(2)}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Legend */}
            <div className="flex items-center justify-center gap-3 mt-3">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-blue-500/60 border border-border/20" />
                <span className="text-[7px] font-mono text-neutral/40">-1 (Inverse)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-transparent border border-border/20" />
                <span className="text-[7px] font-mono text-neutral/40">0 (None)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-red-500/60 border border-border/20" />
                <span className="text-[7px] font-mono text-neutral/40">+1 (Direct)</span>
              </div>
            </div>
          </div>
        )}
        {!isLoading && !error && !data && (
          <div className="flex items-center justify-center py-8 text-[10px] font-mono text-neutral/40 uppercase tracking-widest">
            No correlation data
          </div>
        )}
      </div>
    </GlassCard>
  );
}
