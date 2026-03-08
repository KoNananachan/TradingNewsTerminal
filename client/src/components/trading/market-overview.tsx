import { useState, useMemo } from 'react';
import { useHlMarkets, type HlAsset } from '../../api/hooks/use-hyperliquid-markets';
import { useT } from '../../i18n';
import { Search } from 'lucide-react';

interface MarketItem {
  symbol: string;
  displayName?: string;
  price: number;
  changePercent: number | null;
  type: MarketType;
  // Detail fields (from Hyperliquid)
  funding?: string;
  openInterest?: number;
  dayNtlVlm?: number;
  maxLeverage?: number;
  oraclePx?: number;
}

export type MarketType = 'crypto' | 'stock-perp' | 'commodity';

// Hyperliquid perps that are actually commodity/index proxies
const COMMODITY_DISPLAY: Record<string, string> = {
  PAXG: 'Gold',
};

interface MarketOverviewProps {
  onSelectCoin: (coin: string, type: MarketType) => void;
  selectedCoin: string;
}

const PRIORITY_STOCKS = ['AAPL', 'NVDA', 'TSLA', 'AMZN', 'GOOGL', 'MSFT', 'META', 'AMD', 'NFLX', 'COIN', 'MSTR', 'JPM', 'V', 'BA', 'DIS', 'INTC', 'PYPL', 'UBER', 'SQ', 'PLTR'];
const TYPE_ORDER: Record<string, number> = { 'stock-perp': 0, commodity: 1, crypto: 2 };

function hlAssetToItem(a: HlAsset): MarketItem {
  return {
    symbol: a.symbol,
    displayName: COMMODITY_DISPLAY[a.displayName] || (a.symbol !== a.displayName ? a.displayName : undefined),
    price: a.markPx,
    changePercent: a.changePercent,
    type: COMMODITY_DISPLAY[a.displayName] ? 'commodity' : a.type,
    funding: a.funding,
    openInterest: a.openInterest,
    dayNtlVlm: a.dayNtlVlm,
    maxLeverage: a.maxLeverage,
    oraclePx: a.oraclePx,
  };
}

export function MarketOverview({ onSelectCoin, selectedCoin }: MarketOverviewProps) {
  const { data: hlData } = useHlMarkets();
  const t = useT();
  const [filter, setFilter] = useState('');

  const items = useMemo(() => {
    const result: MarketItem[] = [];

    // All market data from Hyperliquid (via server)
    if (hlData) {
      for (const a of hlData.stockPerps) result.push(hlAssetToItem(a));
      for (const a of hlData.perps) result.push(hlAssetToItem(a));
    }

    // Sort: stock-perps → commodities → crypto
    result.sort((a, b) => {
      const typeOrd = (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9);
      if (typeOrd !== 0) return typeOrd;
      if (a.type === 'stock-perp') {
        const aName = a.displayName ?? a.symbol;
        const bName = b.displayName ?? b.symbol;
        const ai = PRIORITY_STOCKS.indexOf(aName);
        const bi = PRIORITY_STOCKS.indexOf(bName);
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
      }
      return a.symbol.localeCompare(b.symbol);
    });

    if (!filter) return result;
    const q = filter.toUpperCase();
    return result.filter((m) => m.symbol.toUpperCase().includes(q) || (m.displayName?.toUpperCase().includes(q)));
  }, [hlData, filter]);

  // Find selected item for detail display
  const selectedItem = items.find(m => m.symbol === selectedCoin);

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

      {/* Selected asset detail */}
      {selectedItem && (selectedItem.funding != null || selectedItem.type === 'stock-perp') && (
        <div className="px-2 py-1.5 border-b border-border/30 bg-black/60 shrink-0 space-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black text-white uppercase tracking-wider">
              {selectedItem.displayName ?? selectedItem.symbol}
            </span>
            <span className={`text-[9px] font-bold ${(selectedItem.changePercent ?? 0) >= 0 ? 'text-bullish' : 'text-bearish'}`}>
              {selectedItem.changePercent != null ? `${selectedItem.changePercent >= 0 ? '+' : ''}${selectedItem.changePercent.toFixed(2)}%` : ''}
            </span>
          </div>
          {selectedItem.funding != null && (
            <div className="grid grid-cols-2 gap-x-2 text-[8px] font-mono text-neutral/60">
              <span>Fund: <span className="text-white/70">{(parseFloat(selectedItem.funding) * 100).toFixed(4)}%</span></span>
              <span>Lev: <span className="text-white/70">{selectedItem.maxLeverage}x</span></span>
              <span>OI: <span className="text-white/70">${fmtCompact(selectedItem.openInterest ?? 0)}</span></span>
              <span>24h: <span className="text-white/70">${fmtCompact(selectedItem.dayNtlVlm ?? 0)}</span></span>
              {selectedItem.oraclePx != null && (
                <span className="col-span-2">Oracle: <span className="text-white/70">${fmtPrice(selectedItem.oraclePx)}</span></span>
              )}
            </div>
          )}
        </div>
      )}

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
                  : m.type === 'stock-perp'
                    ? 'text-violet-400/70 border-violet-400/20'
                    : 'text-yellow-400/70 border-yellow-400/20'
              }`}>
                {m.type === 'commodity' ? 'CMDTY' : m.type === 'stock-perp' ? 'S-PERP' : 'PERP'}
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
            {hlData ? t('noMarkets') : t('loadingMarkets')}
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

function fmtCompact(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(0);
}
