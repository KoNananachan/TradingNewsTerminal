import { useState } from 'react';
import { PolymarketMarkets } from '../trading/polymarket-markets';
import { PolymarketOrderbook } from '../trading/polymarket-orderbook';
import { parseJsonArray, type PolymarketMarket } from '../../lib/polymarket/types';
import { useT } from '../../i18n';
import { TrendingUp, Target, FlaskConical } from 'lucide-react';

export function PredictionTradingPanel() {
  const [selectedMarket, setSelectedMarket] = useState<PolymarketMarket | null>(null);
  const [selectedOutcomeIdx, setSelectedOutcomeIdx] = useState(0);
  const t = useT();

  const tokenIds = selectedMarket ? parseJsonArray<string>(selectedMarket.clobTokenIds) : [];
  const outcomes = selectedMarket ? parseJsonArray<string>(selectedMarket.outcomes) : [];
  const selectedTokenId = tokenIds[selectedOutcomeIdx] ?? null;

  return (
    <div className="h-full flex flex-col bg-black overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#050505] border-b border-border/30 shrink-0">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-violet-400" />
          <span className="text-[9px] font-black font-mono uppercase tracking-tighter text-violet-400">
            Polymarket
          </span>
        </div>
      </div>

      {/* Early access banner */}
      <div className="px-3 py-1.5 bg-amber-500/[0.08] border-b border-amber-500/30 shrink-0 flex items-center gap-2">
        <FlaskConical className="w-3 h-3 text-amber-400 shrink-0" />
        <span className="text-[8px] font-mono font-bold text-amber-400/90 uppercase tracking-wider leading-tight">
          Early Access — Trading coming soon. Browse prediction markets below.
        </span>
      </div>

      {/* Tab bar - markets only (trading/positions hidden until tested) */}
      <div className="flex border-b border-border/30 bg-black/40 shrink-0">
        <button
          className="flex items-center gap-1.5 px-4 py-2 text-[9px] font-black uppercase tracking-widest border-b-2 border-violet-400 text-violet-400 bg-violet-400/5"
        >
          <TrendingUp className="w-3 h-3" />
          {t('predMarkets')}
        </button>
      </div>

      {/* Content — browse-only, no trade form */}
      <div className="flex-1 overflow-hidden min-h-0">
        <div className="h-full flex">
          {/* Market list - left */}
          <div className="w-[280px] border-r border-border/20 shrink-0 flex flex-col overflow-hidden">
            <PolymarketMarkets
              onSelectMarket={(m) => { setSelectedMarket(m); setSelectedOutcomeIdx(0); }}
              selectedMarketId={selectedMarket?.id ?? null}
            />
          </div>

          {selectedMarket ? (
            /* Orderbook only — no trade form */
            <div className="flex-1 flex flex-col overflow-hidden min-w-[160px]">
              {/* Outcome toggle */}
              {outcomes.length > 0 && (
                <div className="flex border-b border-border/20 bg-black/60 shrink-0">
                  {outcomes.map((out, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedOutcomeIdx(i)}
                      className={`flex-1 py-1 text-[8px] font-black uppercase tracking-widest border-b-2 transition-colors ${
                        selectedOutcomeIdx === i
                          ? out.toLowerCase() === 'yes'
                            ? 'border-bullish text-bullish'
                            : 'border-bearish text-bearish'
                          : 'border-transparent text-neutral/40 hover:text-neutral'
                      }`}
                    >
                      {out}
                    </button>
                  ))}
                </div>
              )}
              {selectedTokenId ? (
                <PolymarketOrderbook
                  tokenId={selectedTokenId}
                  outcomeName={outcomes[selectedOutcomeIdx] || 'Yes'}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-neutral/30 text-[9px] font-mono uppercase">
                  No token data
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4">
              <Target className="w-8 h-8 text-neutral/15" />
              <span className="text-[10px] font-mono text-neutral/30 uppercase tracking-widest text-center">
                {t('predSelectMarket')}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
