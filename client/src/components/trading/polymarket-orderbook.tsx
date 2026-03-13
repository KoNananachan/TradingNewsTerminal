import { useMemo } from 'react';
import { useCLOBBook, useCLOBMidpoint } from '../../hooks/use-polymarket';
import { useT } from '../../i18n';

interface PolymarketOrderbookProps {
  tokenId: string;
  outcomeName: string;
  compact?: boolean;
}

export function PolymarketOrderbook({ tokenId, outcomeName, compact }: PolymarketOrderbookProps) {
  const t = useT();
  const { data: book } = useCLOBBook(tokenId);
  const { data: midData } = useCLOBMidpoint(tokenId);

  const midPrice = midData?.mid ? parseFloat(midData.mid) : null;
  const rows = compact ? 5 : 10;

  const bids = useMemo(() => {
    if (!book?.bids) return [];
    return book.bids.slice(0, rows);
  }, [book, rows]);

  const asks = useMemo(() => {
    if (!book?.asks) return [];
    return book.asks.slice(0, rows).reverse();
  }, [book, rows]);

  const maxSize = useMemo(() => {
    const allSizes = [...bids, ...asks].map(l => parseFloat(l.size));
    return Math.max(...allSizes, 1);
  }, [bids, asks]);

  // Calculate spread between best bid and best ask
  const spread = useMemo(() => {
    if (!book?.bids?.length || !book?.asks?.length) return null;
    const bestBid = parseFloat(book.bids[0].price);
    const bestAsk = parseFloat(book.asks[0].price);
    if (isNaN(bestBid) || isNaN(bestAsk)) return null;
    return bestAsk - bestBid;
  }, [book]);

  return (
    <div className={compact ? 'overflow-hidden' : 'flex flex-col h-full overflow-hidden'}>
      {/* Header — hidden in compact mode */}
      {!compact && (
        <div className="flex items-center justify-between px-3 py-1 border-b border-border/30 bg-black/60 shrink-0">
          <span className="text-[9px] font-black uppercase tracking-[0.15em] text-violet-400">
            {outcomeName} {t('orderbookTitle')}
          </span>
        </div>
      )}

      <div className="grid grid-cols-3 px-3 py-0.5 border-b border-border/20 text-[7px] font-black text-neutral/40 uppercase tracking-wider">
        <span>{t('price')}</span>
        <span className="text-center">{t('size')}</span>
        <span className="text-right">{t('predTotal')}</span>
      </div>

      {/* Asks (sells) */}
      <div className={compact ? '' : 'flex-1 overflow-hidden flex flex-col justify-end'}>
        {asks.length === 0 && (
          <div className="text-center py-2 text-neutral/20 text-[8px] font-mono">{t('noAsks')}</div>
        )}
        {asks.map((level, i) => {
          const size = parseFloat(level.size) || 0;
          const price = parseFloat(level.price) || 0;
          const pct = (size / maxSize) * 100;
          return (
            <div key={`a-${i}`} className="grid grid-cols-3 px-3 py-[1px] relative text-[10px] font-mono">
              <div className="absolute right-0 top-0 bottom-0 bg-bearish/8" style={{ width: `${pct}%` }} />
              <span className="text-bearish font-bold relative z-10">{fmtPrice(level.price)}</span>
              <span className="text-center text-gray-500 relative z-10">{fmtSize(size)}</span>
              <span className="text-right text-gray-600 relative z-10">${fmtNotional(size * price)}</span>
            </div>
          );
        })}
      </div>

      {/* Mid price + spread */}
      <div className="px-3 py-1 border-y border-border/30 bg-black/80 flex items-center justify-center gap-3">
        <div>
          <span className="text-[12px] font-mono font-black text-white">
            {midPrice != null ? `${(midPrice * 100).toFixed(1)}%` : '—'}
          </span>
          <span className="text-[8px] font-mono text-neutral/40 ml-1.5">
            {midPrice != null ? `$${midPrice.toFixed(3)}` : ''}
          </span>
        </div>
        {spread != null && (
          <span className="text-[8px] font-mono text-neutral/30">
            {t('predSpread')}: {(spread * 100).toFixed(1)}%
          </span>
        )}
      </div>

      {/* Bids (buys) */}
      <div className={compact ? '' : 'flex-1 overflow-hidden'}>
        {bids.length === 0 && (
          <div className="text-center py-2 text-neutral/20 text-[8px] font-mono">{t('noBids')}</div>
        )}
        {bids.map((level, i) => {
          const size = parseFloat(level.size) || 0;
          const price = parseFloat(level.price) || 0;
          const pct = (size / maxSize) * 100;
          return (
            <div key={`b-${i}`} className="grid grid-cols-3 px-3 py-[1px] relative text-[10px] font-mono">
              <div className="absolute right-0 top-0 bottom-0 bg-bullish/8" style={{ width: `${pct}%` }} />
              <span className="text-bullish font-bold relative z-10">{fmtPrice(level.price)}</span>
              <span className="text-center text-gray-500 relative z-10">{fmtSize(size)}</span>
              <span className="text-right text-gray-600 relative z-10">${fmtNotional(size * price)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function fmtPrice(px: string): string {
  const n = parseFloat(px);
  return `${(n * 100).toFixed(1)}%`;
}

function fmtSize(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toFixed(0);
}

function fmtNotional(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toFixed(0);
}
