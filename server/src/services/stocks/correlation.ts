import { getHistory } from './yahoo-finance.js';

/**
 * Calculate Pearson correlation coefficient between two arrays of returns.
 */
export function calculateCorrelation(returns1: number[], returns2: number[]): number {
  const n = Math.min(returns1.length, returns2.length);
  if (n < 2) return 0;

  const r1 = returns1.slice(0, n);
  const r2 = returns2.slice(0, n);

  const mean1 = r1.reduce((a, b) => a + b, 0) / n;
  const mean2 = r2.reduce((a, b) => a + b, 0) / n;

  let cov = 0;
  let var1 = 0;
  let var2 = 0;

  for (let i = 0; i < n; i++) {
    const d1 = r1[i] - mean1;
    const d2 = r2[i] - mean2;
    cov += d1 * d2;
    var1 += d1 * d1;
    var2 += d2 * d2;
  }

  const denom = Math.sqrt(var1 * var2);
  if (denom === 0) return 0;

  return Math.round((cov / denom) * 1000) / 1000;
}

/**
 * Convert price history to daily returns.
 */
function pricesToReturns(prices: Array<{ close: number | null }>): number[] {
  const returns: number[] = [];
  const validPrices = prices.filter(p => p.close != null).map(p => p.close!);

  for (let i = 1; i < validPrices.length; i++) {
    if (validPrices[i - 1] === 0) {
      returns.push(0);
    } else {
      returns.push((validPrices[i] - validPrices[i - 1]) / validPrices[i - 1]);
    }
  }

  return returns;
}

const PERIOD_RANGE_MAP: Record<string, string> = {
  '1M': '1mo',
  '3M': '3mo',
  '6M': '6mo',
  '1Y': '1y',
};

/**
 * Calculate pairwise correlation matrix for a set of symbols.
 */
export async function getCorrelationMatrix(
  symbols: string[],
  period: string = '3M',
): Promise<{ matrix: number[][]; symbols: string[] }> {
  const range = PERIOD_RANGE_MAP[period] || '3mo';

  // Fetch all histories in parallel
  const histories = await Promise.all(
    symbols.map(symbol => getHistory(symbol, { range }))
  );

  // Convert to returns
  const allReturns = histories.map(h => pricesToReturns(h));

  // Build correlation matrix
  const n = symbols.length;
  const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1; // Self-correlation is always 1
    for (let j = i + 1; j < n; j++) {
      const corr = calculateCorrelation(allReturns[i], allReturns[j]);
      matrix[i][j] = corr;
      matrix[j][i] = corr; // Symmetric
    }
  }

  return { matrix, symbols };
}
