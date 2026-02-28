import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { PortfolioView } from '../trading/portfolio-view';
import { Orderbook } from '../trading/orderbook';
import { TradeForm } from '../trading/trade-form';
import { RecentFills } from '../trading/recent-fills';
import { MarketOverview, type MarketType } from '../trading/market-overview';
import { useAppStore } from '../../stores/use-app-store';
import { useT } from '../../i18n';
import { Wallet, BookOpen, ArrowRightLeft, History, BarChart3 } from 'lucide-react';

type TradingTab = 'portfolio' | 'trade' | 'fills';

export function TradingPanel() {
  const { isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<TradingTab>('trade');
  const [selectedCoin, setSelectedCoin] = useState('BTC');
  const [coinType, setCoinType] = useState<MarketType>('crypto');
  const tradingCoin = useAppStore((s) => s.tradingCoin);
  const setTradingCoin = useAppStore((s) => s.setTradingCoin);
  const t = useT();

  // Respond to external coin selection from news detail
  useEffect(() => {
    if (tradingCoin) {
      setSelectedCoin(tradingCoin);
      setActiveTab('trade');
      setTradingCoin(null); // consume the signal
    }
  }, [tradingCoin, setTradingCoin]);

  const tabs: { id: TradingTab; label: string; icon: React.ReactNode }[] = [
    { id: 'trade', label: t('trade'), icon: <ArrowRightLeft className="w-3 h-3" /> },
    { id: 'portfolio', label: t('portfolio'), icon: <Wallet className="w-3 h-3" /> },
    { id: 'fills', label: t('fills'), icon: <History className="w-3 h-3" /> },
  ];

  return (
    <div className="h-full flex flex-col bg-black overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#050505] border-b border-border/30 shrink-0">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-accent" />
          <span className="text-[11px] font-black uppercase tracking-widest text-accent">
            Hyperliquid
          </span>
        </div>
        {isConnected && (
          <span className="text-[9px] font-mono text-bullish flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-bullish inline-block" />
            CONNECTED
          </span>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border/30 bg-black/40 shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-[9px] font-black uppercase tracking-widest border-b-2 ${
              activeTab === tab.id
                ? 'border-accent text-accent bg-accent/5'
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
        {activeTab === 'trade' && (
          <div className="h-full flex">
            {/* Market selector - left column */}
            <div className="w-[140px] border-r border-border/20 shrink-0 flex flex-col overflow-hidden">
              <MarketOverview
                onSelectCoin={(coin, type) => { setSelectedCoin(coin); setCoinType(type); }}
                selectedCoin={selectedCoin}
              />
            </div>

            {/* Orderbook - center */}
            <div className="flex-1 border-r border-border/20 flex flex-col overflow-hidden">
              <div className="px-3 py-1 border-b border-border/20 bg-black/60 shrink-0 flex items-center gap-2">
                <BookOpen className="w-3 h-3 text-accent" />
                <span className="text-[9px] font-black uppercase tracking-[0.15em] text-accent">
                  {selectedCoin}{coinType === 'stock' ? '/USDH Spot' : '-USD Perp'}
                  {coinType === 'commodity' && <span className="ml-1 text-amber-400/60">(Commodity)</span>}
                </span>
              </div>
              <Orderbook coin={selectedCoin} />
            </div>

            {/* Trade form - right */}
            <div className="w-[220px] shrink-0 overflow-auto no-scrollbar">
              <TradeForm coin={selectedCoin} coinType={coinType} />
            </div>
          </div>
        )}

        {activeTab === 'portfolio' && (
          <div className="h-full overflow-auto no-scrollbar">
            <PortfolioView />
          </div>
        )}

        {activeTab === 'fills' && (
          <div className="h-full overflow-hidden flex flex-col">
            <div className="px-3 py-1.5 border-b border-border/20 bg-black/60 shrink-0">
              <span className="text-[9px] font-black uppercase tracking-[0.15em] text-accent">
                {t('recentFills')}
              </span>
            </div>
            <RecentFills />
          </div>
        )}
      </div>
    </div>
  );
}
