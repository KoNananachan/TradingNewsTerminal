import { useState } from 'react';
import { useAccount } from 'wagmi';
import { PolymarketMarkets } from '../trading/polymarket-markets';
import { PolymarketOrderbook } from '../trading/polymarket-orderbook';
import { PolymarketTradeForm } from '../trading/polymarket-trade-form';
import { useCLOBPositions } from '../../hooks/use-polymarket';
import { parseJsonArray, type PolymarketMarket } from '../../lib/polymarket/types';
import { useT } from '../../i18n';
import { useAuthStore } from '../../stores/use-auth-store';
import { TrendingUp, Wallet, Target, BarChart3 } from 'lucide-react';

type PredictionTab = 'markets' | 'positions';

export function PredictionTradingPanel() {
  const { isConnected, address } = useAccount();
  const [activeTab, setActiveTab] = useState<PredictionTab>('markets');
  const [selectedMarket, setSelectedMarket] = useState<PolymarketMarket | null>(null);
  const [selectedOutcomeIdx, setSelectedOutcomeIdx] = useState(0);
  const t = useT();

  const tokenIds = selectedMarket ? parseJsonArray<string>(selectedMarket.clobTokenIds) : [];
  const outcomes = selectedMarket ? parseJsonArray<string>(selectedMarket.outcomes) : [];
  const selectedTokenId = tokenIds[selectedOutcomeIdx] ?? null;

  const tabs: { id: PredictionTab; label: string; icon: React.ReactNode }[] = [
    { id: 'markets', label: t('predMarkets'), icon: <TrendingUp className="w-3 h-3" /> },
    { id: 'positions', label: t('predPositions'), icon: <Wallet className="w-3 h-3" /> },
  ];

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
        <div className="flex items-center gap-2">
          {isConnected && (
            <span className="text-[9px] font-mono text-bullish flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-bullish inline-block" />
              {t('connected')}
            </span>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border/30 bg-black/40 shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-[9px] font-black uppercase tracking-widest border-b-2 ${
              activeTab === tab.id
                ? 'border-violet-400 text-violet-400 bg-violet-400/5'
                : 'border-transparent text-neutral/50 hover:text-neutral hover:bg-white/[0.02]'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden min-h-0">
        {activeTab === 'markets' && (
          <div className="h-full flex">
            {/* Market list - left */}
            <div className="w-[280px] border-r border-border/20 shrink-0 flex flex-col overflow-hidden">
              <PolymarketMarkets
                onSelectMarket={(m) => { setSelectedMarket(m); setSelectedOutcomeIdx(0); }}
                selectedMarketId={selectedMarket?.id ?? null}
              />
            </div>

            {selectedMarket ? (
              <>
                {/* Orderbook - center */}
                <div className="flex-1 border-r border-border/20 flex flex-col overflow-hidden min-w-[160px]">
                  {/* Outcome toggle for orderbook */}
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

                {/* Trade form - right */}
                <div className="w-[240px] shrink-0 overflow-hidden">
                  <PolymarketTradeForm market={selectedMarket} />
                </div>
              </>
            ) : (
              /* Empty state */
              <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4">
                <Target className="w-8 h-8 text-neutral/15" />
                <span className="text-[10px] font-mono text-neutral/30 uppercase tracking-widest text-center">
                  {t('predSelectMarket')}
                </span>
              </div>
            )}
          </div>
        )}

        {activeTab === 'positions' && (
          <PositionsView address={address ?? null} />
        )}
      </div>
    </div>
  );
}

function PositionsView({ address }: { address: string | null }) {
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const setLoginModalOpen = useAuthStore((s) => s.setLoginModalOpen);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Wallet className="w-6 h-6 text-neutral/30" />
        <button
          onClick={() => setLoginModalOpen(true)}
          className="text-[10px] font-mono text-accent uppercase tracking-widest hover:text-accent/80"
        >
          {t('login')}
        </button>
      </div>
    );
  }

  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Wallet className="w-6 h-6 text-neutral/30" />
        <span className="text-[10px] font-mono text-neutral/40 uppercase tracking-widest">
          {t('connectWallet')}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <BarChart3 className="w-6 h-6 text-neutral/20" />
      <span className="text-[10px] font-mono text-neutral/30 uppercase tracking-widest text-center px-6">
        {t('predNoPositions')}
      </span>
      <span className="text-[8px] font-mono text-neutral/20 text-center px-6">
        Positions will appear here after you place trades on Polymarket
      </span>
    </div>
  );
}
