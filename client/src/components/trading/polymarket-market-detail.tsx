import { useState } from 'react';
import { BarChart3, Clock, Droplets, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { parseJsonArray, type PolymarketMarket } from '../../lib/polymarket/types';
import { PolymarketSparkline } from './polymarket-sparkline';
import { useT } from '../../i18n';

interface PolymarketMarketDetailProps {
  market: PolymarketMarket;
}

export function PolymarketMarketDetail({ market }: PolymarketMarketDetailProps) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const prices = parseJsonArray<number>(market.outcomePrices);
  const outcomes = parseJsonArray<string>(market.outcomes);
  const volume = parseFloat(market.volume || '0');
  const volume24h = parseFloat(market.volume24hr || '0');
  const liquidity = parseFloat(market.liquidity || '0');
  const endDate = market.endDate ? new Date(market.endDate) : null;

  return (
    <div className="border-b border-border/30 bg-black/60 shrink-0">
      {/* Market title + image */}
      <div className="flex gap-2.5 px-3 py-2">
        {market.image && (
          <img
            src={market.image}
            alt=""
            className="w-12 h-12 object-cover shrink-0 border border-border/20"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-[11px] font-mono font-black text-white leading-tight mb-1">
            {market.question}
          </h3>
          {/* Odds bar */}
          <div className="flex items-center gap-2 mb-1.5">
            {outcomes.map((out, i) => (
              <span
                key={i}
                className={`text-[10px] font-mono font-bold ${
                  i === 0 ? 'text-bullish' : 'text-bearish'
                }`}
              >
                {out} {((prices[i] ?? 0) * 100).toFixed(1)}%
              </span>
            ))}
          </div>

          {/* Sparkline — larger in detail view */}
          {market.conditionId && (
            <PolymarketSparkline conditionId={market.conditionId} width={160} height={24} />
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 px-3 pb-1.5 text-[8px] font-mono text-neutral/40">
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
          <span className="flex items-center gap-0.5" title="Liquidity">
            <Droplets className="w-2.5 h-2.5" />
            ${fmtVolume(liquidity)}
          </span>
        )}
        {endDate && (
          <span className="flex items-center gap-0.5" title="End date">
            <Clock className="w-2.5 h-2.5" />
            {endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        )}
        {(market.events?.[0]?.slug || market.slug) && (
          <a
            href={`https://polymarket.com/event/${market.events?.[0]?.slug || market.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-0.5 text-violet-400/50 hover:text-violet-400 transition-colors"
          >
            <ExternalLink className="w-2.5 h-2.5" />
            Polymarket
          </a>
        )}
      </div>

      {/* Expandable description */}
      {market.description && (
        <div className="px-3 pb-1.5">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[8px] font-mono text-neutral/30 hover:text-neutral/60 transition-colors"
          >
            {expanded ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
            {t('predDescription')}
          </button>
          {expanded && (
            <p className="mt-1 text-[9px] font-mono text-neutral/50 leading-relaxed max-h-[120px] overflow-auto no-scrollbar">
              {market.description}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function fmtVolume(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toFixed(0);
}
