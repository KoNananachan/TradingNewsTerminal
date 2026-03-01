export interface AlertEvalContext {
  symbol: string;
  currentPrice: number;
  previousPrice: number;
  volume: number;
  avgVolume: number;
}

export function evaluatePriceCross(
  condition: { threshold: number; direction: 'above' | 'below' },
  ctx: AlertEvalContext,
): { triggered: boolean; message: string } {
  if (condition.direction === 'above') {
    const triggered = ctx.previousPrice < condition.threshold && ctx.currentPrice >= condition.threshold;
    return {
      triggered,
      message: triggered
        ? `${ctx.symbol} crossed above $${condition.threshold} (now $${ctx.currentPrice.toFixed(2)})`
        : '',
    };
  } else {
    const triggered = ctx.previousPrice > condition.threshold && ctx.currentPrice <= condition.threshold;
    return {
      triggered,
      message: triggered
        ? `${ctx.symbol} crossed below $${condition.threshold} (now $${ctx.currentPrice.toFixed(2)})`
        : '',
    };
  }
}

export function evaluatePriceChangePct(
  condition: { threshold: number },
  ctx: AlertEvalContext,
): { triggered: boolean; message: string } {
  if (ctx.previousPrice === 0) return { triggered: false, message: '' };

  const changePct = Math.abs((ctx.currentPrice - ctx.previousPrice) / ctx.previousPrice) * 100;
  const triggered = changePct >= condition.threshold;
  const direction = ctx.currentPrice > ctx.previousPrice ? 'up' : 'down';

  return {
    triggered,
    message: triggered
      ? `${ctx.symbol} moved ${direction} ${changePct.toFixed(2)}% (threshold: ${condition.threshold}%)`
      : '',
  };
}

export function evaluateVolumeSpike(
  condition: { multiplier: number },
  ctx: AlertEvalContext,
): { triggered: boolean; message: string } {
  if (ctx.avgVolume === 0) return { triggered: false, message: '' };

  const ratio = ctx.volume / ctx.avgVolume;
  const triggered = ratio >= condition.multiplier;

  return {
    triggered,
    message: triggered
      ? `${ctx.symbol} volume spike: ${ratio.toFixed(1)}x average (${ctx.volume.toLocaleString()} vs avg ${ctx.avgVolume.toLocaleString()})`
      : '',
  };
}
