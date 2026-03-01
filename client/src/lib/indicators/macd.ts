import { ema } from './index';

export interface MacdResult {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
}

export function macd(
  closes: number[],
  fast: number = 12,
  slow: number = 26,
  signal: number = 9,
): MacdResult {
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);

  const macdLine: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (emaFast[i] != null && emaSlow[i] != null) {
      macdLine.push(emaFast[i]! - emaSlow[i]!);
    } else {
      macdLine.push(null);
    }
  }

  const validMacd = macdLine.filter((v): v is number => v !== null);
  const signalLine = ema(validMacd, signal);

  // Align signal line with macd line
  const alignedSignal: (number | null)[] = [];
  const histogram: (number | null)[] = [];
  let si = 0;
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] !== null) {
      alignedSignal.push(signalLine[si] ?? null);
      histogram.push(
        macdLine[i] !== null && signalLine[si] !== null
          ? macdLine[i]! - signalLine[si]!
          : null,
      );
      si++;
    } else {
      alignedSignal.push(null);
      histogram.push(null);
    }
  }

  return { macd: macdLine, signal: alignedSignal, histogram };
}
