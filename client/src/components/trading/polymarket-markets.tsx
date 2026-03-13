import { useState, useMemo, memo, useEffect, useRef } from 'react';
import { usePolymarketMarkets } from '../../hooks/use-polymarket';
import { useT } from '../../i18n';
import { Search, Clock, BarChart3, ArrowUpDown } from 'lucide-react';
import { parseJsonArray, type PolymarketMarket, type MarketCategory } from '../../lib/polymarket/types';
import { PolymarketSparkline } from './polymarket-sparkline';

import type { TranslationKey } from '../../i18n';

const CATEGORIES: { id: MarketCategory; key: TranslationKey }[] = [
  { id: 'all', key: 'predCatAll' },
  { id: 'politics', key: 'predCatPolitics' },
  { id: 'crypto', key: 'predCatCrypto' },
  { id: 'sports', key: 'predCatSports' },
  { id: 'science', key: 'predCatScience' },
  { id: 'pop-culture', key: 'predCatCulture' },
];

type SortMode = 'competitive' | 'volume' | 'newest' | 'ending';

interface PolymarketMarketsProps {
  onSelectMarket: (market: PolymarketMarket) => void;
  selectedMarketId: string | null;
}

export function PolymarketMarkets({ onSelectMarket, selectedMarketId }: PolymarketMarketsProps) {
  const t = useT();
  const [filter, setFilter] = useState('');
  const [debouncedFilter, setDebouncedFilter] = useState('');
  const [category, setCategory] = useState<MarketCategory>('all');
  const [sortMode, setSortMode] = useState<SortMode>('competitive');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Debounce search input — send to server after 400ms idle
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedFilter(filter.trim());
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [filter]);

  const { data: markets, isLoading } = usePolymarketMarkets({
    limit: 100,
    tag: category === 'all' ? undefined : category,
    q: debouncedFilter || undefined,
  });

  const filtered = useMemo(() => {
    if (!markets) return [];
    const active = markets.filter((m) => !m.closed && m.active);

    return active.slice().sort((a, b) => {
      switch (sortMode) {
        case 'competitive': {
          // Balanced odds first (max price closest to 0.5), near-decided last
          const pricesA = parseJsonArray<number>(a.outcomePrices);
          const pricesB = parseJsonArray<number>(b.outcomePrices);
          const maxA = pricesA.length > 0 ? Math.max(...pricesA) : 1;
          const maxB = pricesB.length > 0 ? Math.max(...pricesB) : 1;
          return maxA - maxB;
        }
        case 'volume': {
          const volA = parseFloat(a.volume24hr || '0');
          const volB = parseFloat(b.volume24hr || '0');
          return volB - volA;
        }
        case 'newest': {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        case 'ending': {
          const endA = a.endDate ? new Date(a.endDate).getTime() : Infinity;
          const endB = b.endDate ? new Date(b.endDate).getTime() : Infinity;
          return endA - endB;
        }
        default:
          return 0;
      }
    });
  }, [markets, filter, sortMode]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Category tabs */}
      <div className="flex border-b border-border/30 bg-black/60 shrink-0 overflow-x-auto no-scrollbar">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className={`px-3 py-1.5 text-[8px] font-black uppercase tracking-widest whitespace-nowrap border-b-2 transition-colors ${
              category === cat.id
                ? 'border-violet-400 text-violet-400'
                : 'border-transparent text-neutral/40 hover:text-neutral'
            }`}
          >
            {t(cat.key)}
          </button>
        ))}
      </div>

      {/* Search + sort */}
      <div className="px-2 py-1.5 border-b border-border/30 bg-black/40 shrink-0 space-y-1">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral/50" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('filterPredictions')}
            className="w-full bg-black/60 border border-border/30 pl-7 pr-2 py-1 text-[10px] font-mono text-white placeholder:text-neutral/30"
          />
        </div>
        <div className="flex items-center gap-0.5">
          <ArrowUpDown className="w-2.5 h-2.5 text-neutral/30 shrink-0" />
          {(['competitive', 'volume', 'newest', 'ending'] as SortMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setSortMode(mode)}
              className={`px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wider transition-colors ${
                sortMode === mode
                  ? 'bg-violet-400/20 text-violet-400'
                  : 'text-neutral/30 hover:text-neutral/60'
              }`}
            >
              {t(`predSort_${mode}` as TranslationKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Market list */}
      <div className="flex-1 overflow-auto no-scrollbar">
        {isLoading && (
          <div className="text-center py-6 text-violet-400 text-[9px] font-mono uppercase animate-pulse">
            {t('loadingMarkets')}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-6 text-neutral/40 text-[9px] font-mono uppercase">
            {t('noMarkets')}
          </div>
        )}

        {filtered.map((market, idx) => (
          <MarketCard
            key={market.id}
            market={market}
            selected={selectedMarketId === market.id}
            onSelect={() => onSelectMarket(market)}
            showSparkline={idx < 15}
          />
        ))}
      </div>
    </div>
  );
}

const MarketCard = memo(function MarketCard({ market, selected, onSelect, showSparkline }: {
  market: PolymarketMarket;
  selected: boolean;
  onSelect: () => void;
  showSparkline: boolean;
}) {
  const outcomes = parseJsonArray<string>(market.outcomes);
  const prices = parseJsonArray<number>(market.outcomePrices);
  const yesPrice = prices[0] ?? 0;
  const noPrice = prices[1] ?? 0;
  const volume = parseFloat(market.volume || '0');
  const volume24h = parseFloat(market.volume24hr || '0');
  const endDate = market.endDate ? new Date(market.endDate) : null;
  const liquidity = parseFloat(market.liquidity || '0');

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-3 py-2.5 border-b border-border/10 hover:bg-violet-400/[0.03] transition-colors group ${
        selected ? 'bg-violet-400/[0.06] border-l-2 border-l-violet-400' : ''
      }`}
    >
      <div className="flex gap-2.5">
        {/* Image */}
        {market.image && (
          <img
            src={market.image}
            alt=""
            className="w-10 h-10 object-cover shrink-0 border border-border/20 mt-0.5"
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}

        <div className="flex-1 min-w-0">
          {/* Question */}
          <div className="text-[10px] font-mono font-bold text-white leading-tight mb-1 line-clamp-2 group-hover:text-violet-200">
            {market.question}
          </div>

          {/* Outcome bar */}
          <div className="flex items-center gap-1.5 mb-1">
            <div className="flex-1 h-1.5 bg-black border border-border/20 overflow-hidden flex">
              <div
                className="bg-bullish/70 h-full"
                style={{ width: `${yesPrice * 100}%` }}
              />
              <div
                className="bg-bearish/70 h-full"
                style={{ width: `${noPrice * 100}%` }}
              />
            </div>
            <div className="flex gap-1 shrink-0">
              <span className="text-[9px] font-mono font-bold text-bullish">
                {fmtPct(yesPrice)}%
              </span>
              <span className="text-[8px] font-mono text-neutral/30">/</span>
              <span className="text-[9px] font-mono font-bold text-bearish">
                {fmtPct(noPrice)}%
              </span>
            </div>
          </div>

          {/* Sparkline — only for first N visible to limit API calls */}
          {showSparkline && market.conditionId && (
            <PolymarketSparkline conditionId={market.conditionId} />
          )}

          {/* Meta */}
          <div className="flex items-center gap-2 text-[8px] font-mono text-neutral/40 mt-1">
            <span className="flex items-center gap-0.5" title="Total volume">
              <BarChart3 className="w-2.5 h-2.5" />
              ${fmtVolume(volume)}
            </span>
            {volume24h > 0 && (
              <span className="text-violet-400/50" title="24h volume">
                24h ${fmtVolume(volume24h)}
              </span>
            )}
            {liquidity > 0 && (
              <span title="Liquidity">
                Liq ${fmtVolume(liquidity)}
              </span>
            )}
            {endDate && (
              <span className="flex items-center gap-0.5 ml-auto" title="End date">
                <Clock className="w-2.5 h-2.5" />
                {endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
});

function fmtPct(decimal: number): string {
  const pct = decimal * 100;
  if (pct > 0 && pct < 1) return pct.toFixed(1);
  if (pct > 99 && pct < 100) return pct.toFixed(1);
  return pct.toFixed(0);
}

function fmtVolume(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toFixed(0);
}
