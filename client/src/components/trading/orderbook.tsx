import { useL2Book, useCombinedMids } from '../../hooks/use-hyperliquid';
import { useT } from '../../i18n';

interface OrderbookProps {
  coin: string;
}

export function Orderbook({ coin }: OrderbookProps) {
  const t = useT();
  const { data: book } = useL2Book(coin);
  const { data: mids } = useCombinedMids();

  const midPrice = mids?.[coin] ? parseFloat(mids[coin]) : null;
  const bids = book?.levels?.[0]?.slice(0, 12) ?? [];
  const asks = book?.levels?.[1]?.slice(0, 12).reverse() ?? [];

  const maxQty = Math.max(
    ...bids.map((l) => parseFloat(l.sz)),
    ...asks.map((l) => parseFloat(l.sz)),
    1,
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-3 px-3 py-1 border-b border-border/30 bg-black/60 text-[8px] font-black text-neutral/50 uppercase tracking-[0.15em]">
        <span>{t('price')}</span>
        <span className="text-right">{t('size')}</span>
        <span className="text-right">{t('total')}</span>
      </div>

      {/* Asks (sells) - top */}
      <div className="flex-1 overflow-hidden flex flex-col justify-end">
        {asks.map((level, i) => {
          const pct = (parseFloat(level.sz) / maxQty) * 100;
          return (
            <div key={`a-${i}`} className="grid grid-cols-3 px-3 py-[2px] relative text-[10px] font-mono">
              <div
                className="absolute right-0 top-0 bottom-0 bg-bearish/10"
                style={{ width: `${pct}%` }}
              />
              <span className="text-bearish font-bold relative z-10">{fmtPx(level.px)}</span>
              <span className="text-right text-gray-400 relative z-10">{fmtSz(level.sz)}</span>
              <span className="text-right text-neutral/40 relative z-10">{level.n}</span>
            </div>
          );
        })}
      </div>

      {/* Mid price */}
      <div className="px-3 py-1.5 border-y border-border/30 bg-black/80 text-center">
        <span className="text-[13px] font-mono font-black text-white">
          {midPrice ? fmtPx(String(midPrice)) : '---'}
        </span>
        <span className="text-[9px] font-mono text-neutral/50 ml-2 uppercase">{t('mid')}</span>
      </div>

      {/* Bids (buys) - bottom */}
      <div className="flex-1 overflow-hidden">
        {bids.map((level, i) => {
          const pct = (parseFloat(level.sz) / maxQty) * 100;
          return (
            <div key={`b-${i}`} className="grid grid-cols-3 px-3 py-[2px] relative text-[10px] font-mono">
              <div
                className="absolute right-0 top-0 bottom-0 bg-bullish/10"
                style={{ width: `${pct}%` }}
              />
              <span className="text-bullish font-bold relative z-10">{fmtPx(level.px)}</span>
              <span className="text-right text-gray-400 relative z-10">{fmtSz(level.sz)}</span>
              <span className="text-right text-neutral/40 relative z-10">{level.n}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function fmtPx(px: string): string {
  const n = parseFloat(px);
  if (n >= 1000) return n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(4);
}

function fmtSz(sz: string): string {
  const n = parseFloat(sz);
  if (n >= 1000) return n.toFixed(1);
  if (n >= 1) return n.toFixed(3);
  return n.toFixed(4);
}
