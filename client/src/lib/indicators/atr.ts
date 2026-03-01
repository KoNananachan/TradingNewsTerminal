export function atr(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14,
): (number | null)[] {
  const result: (number | null)[] = [null]; // first bar has no TR

  const trueRanges: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1]),
    );
    trueRanges.push(tr);
  }

  for (let i = 0; i < trueRanges.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      let sum = 0;
      for (let j = 0; j <= i; j++) sum += trueRanges[j];
      result.push(sum / period);
    } else {
      const prevAtr = result[result.length - 1]!;
      result.push((prevAtr * (period - 1) + trueRanges[i]) / period);
    }
  }

  return result;
}
