import { useState, useMemo } from 'react';
import { useAllMids, useMeta } from '../../hooks/use-hyperliquid';
import { useStockQuotes } from '../../api/hooks/use-stocks';
import { useT } from '../../i18n';
import { Search } from 'lucide-react';

interface MarketItem {
  symbol: string;
  displayName?: string;
  price: number;
  changePercent: number | null;
  type: 'crypto' | 'stock' | 'commodity';
}

export type MarketType = 'crypto' | 'stock' | 'commodity';

// Hyperliquid perps that are actually commodity/index proxies
const COMMODITY_PERPS: Record<string, string> = {
  PAXG: 'Gold',
};

interface MarketOverviewProps {
  onSelectCoin: (coin: string, type: MarketType) => void;
  selectedCoin: string;
}

export function MarketOverview({ onSelectCoin, selectedCoin }: MarketOverviewProps) {
  const { data: mids } = useAllMids();
  const { data: meta } = useMeta();
  const { data: stocks } = useStockQuotes();
  const t = useT();
  const [filter, setFilter] = useState('');

  const items = useMemo(() => {
    const result: MarketItem[] = [];

    // Stocks from backend (added first so they sort to top)
    if (stocks) {
      for (const s of stocks) {
        result.push({ symbol: s.symbol, price: s.price, changePercent: s.changePercent, type: 'stock' });
      }
    }

    // Hyperliquid perpetual contracts - separate commodities from crypto
    if (mids && meta) {
      for (const asset of meta.universe) {
        const price = mids[asset.name];
        if (price) {
          const commodityName = COMMODITY_PERPS[asset.name];
          result.push({
            symbol: asset.name,
            displayName: commodityName,
            price: parseFloat(price),
            changePercent: null,
            type: commodityName ? 'commodity' : 'crypto',
          });
        }
      }
    }

    // Sort: stocks → commodities → crypto
    const PRIORITY_STOCKS = ['AAPL', 'NVDA', 'TSLA', 'AMZN', 'GOOGL', 'MSFT', 'META', 'AMD', 'NFLX', 'COIN', 'MSTR', 'JPM', 'V', 'BA', 'DIS', 'INTC', 'PYPL', 'UBER', 'SQ', 'PLTR'];
    const TYPE_ORDER = { stock: 0, commodity: 1, crypto: 2 };
    result.sort((a, b) => {
      // Type ordering: stock → commodity → crypto
      const typeOrd = TYPE_ORDER[a.type] - TYPE_ORDER[b.type];
      if (typeOrd !== 0) return typeOrd;
      // Within stocks: priority list first
      if (a.type === 'stock') {
        const ai = PRIORITY_STOCKS.indexOf(a.symbol);
        const bi = PRIORITY_STOCKS.indexOf(b.symbol);
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
      }
      return a.symbol.localeCompare(b.symbol);
    });

    if (!filter) return result;
    const q = filter.toUpperCase();
    return result.filter((m) => m.symbol.includes(q));
  }, [mids, meta, stocks, filter]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search */}
      <div className="relative px-2 py-2 border-b border-border/30 bg-black/40 shrink-0">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral/50" />
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t('filterMarkets')}
          className="w-full bg-black/60 border border-border/30 pl-7 pr-2 py-1 text-[10px] font-mono text-white placeholder:text-neutral/30"
        />
      </div>

      {/* Market list */}
      <div className="flex-1 overflow-auto no-scrollbar">
        {items.map((m) => (
          <button
            key={m.symbol}
            onClick={() => onSelectCoin(m.symbol, m.type)}
            className={`w-full flex items-center justify-between px-3 py-1.5 border-b border-border/5 text-[10px] font-mono hover:bg-accent/[0.03] ${
              selectedCoin === m.symbol ? 'bg-accent/[0.06] border-l-2 border-l-accent' : ''
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="font-bold text-white">
                {m.displayName ? `${m.displayName}` : m.symbol}
              </span>
              <span className={`text-[7px] px-1 border uppercase tracking-wider font-black ${
                m.type === 'commodity'
                  ? 'text-amber-400/70 border-amber-400/20'
                  : m.type === 'crypto'
                    ? 'text-yellow-400/70 border-yellow-400/20'
                    : 'text-blue-400/70 border-blue-400/20'
              }`}>
                {m.type === 'commodity' ? 'CMDTY' : m.type === 'crypto' ? 'PERP' : 'STK'}
              </span>
            </div>
            <div className="text-right">
              <div className="text-gray-300 font-bold">${fmtPrice(m.price)}</div>
              {m.changePercent != null && (
                <div className={`text-[8px] ${m.changePercent >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                  {m.changePercent >= 0 ? '+' : ''}{m.changePercent.toFixed(2)}%
                </div>
              )}
            </div>
          </button>
        ))}
        {items.length === 0 && (
          <div className="text-center py-6 text-neutral/40 text-[9px] font-mono uppercase">
            {mids || stocks ? t('noMarkets') : t('loadingMarkets')}
          </div>
        )}
      </div>
    </div>
  );
}

function fmtPrice(n: number): string {
  if (n >= 10000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (n >= 100) return n.toFixed(1);
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(4);
}
