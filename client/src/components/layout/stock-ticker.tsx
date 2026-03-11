import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useAppStore } from '../../stores/use-app-store';
import { useT } from '../../i18n';

interface IndexQuote {
  symbol: string;
  price: number;
  change: number | null;
  changePercent: number | null;
}

export function StockTicker() {
  const tickerSpeed = useAppStore((s) => s.settings.tickerSpeed);
  const t = useT();

  const { data: quotes } = useQuery({
    queryKey: ['indices'],
    queryFn: () => api.get<IndexQuote[]>('/stocks/indices'),
    refetchInterval: 60_000,
  });

  if (!quotes || quotes.length === 0) {
    return (
      <div className="bg-panel border-b border-border h-6 flex items-center px-2 shrink-0 z-10 relative">
        <span className="text-[10px] text-accent font-mono uppercase font-bold animate-pulse">{t('awaitingDataStream')}</span>
      </div>
    );
  }

  const items = [...quotes, ...quotes, ...quotes];

  return (
    <div className="ticker-container bg-panel border-b border-border h-6 overflow-hidden shrink-0 cursor-default relative z-10">
      <div className="animate-ticker flex items-center h-full whitespace-nowrap w-max" style={{ animationDuration: `${tickerSpeed}s` }}>
        {items.map((q, i) => {
          const isUp = q.changePercent !== null && q.changePercent > 0;
          const isDown = q.changePercent !== null && q.changePercent < 0;
          
          return (
            <div key={`${q.symbol}-${i}`} className="inline-flex items-center gap-2 px-3 text-[11px] font-mono border-r border-border h-full uppercase tracking-wider">
              <span className="text-accent font-bold">{q.symbol}</span>
              <span className="text-white font-bold">{formatPrice(q.price)}</span>
              {q.changePercent !== null && (
                <span className={`flex items-center gap-1 font-bold ${isUp ? 'text-bullish' : isDown ? 'text-bearish' : 'text-neutral'}`}>
                  {isUp ? '▲' : isDown ? '▼' : '-'}
                  {Math.abs(q.changePercent).toFixed(2)}%
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatPrice(price: number) {
  if (price >= 10000) return price.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (price >= 100) return price.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
