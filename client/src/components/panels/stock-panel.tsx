import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useStockDetail, useStockExtended, type StockProfile, type StockQuote, type ExtendedStockData, type InsiderTransaction } from '../../api/hooks/use-stocks';
import { StockChart as ChartWithIndicators } from '../chart/stock-chart';
import {
  useWatchlist,
  useAddToWatchlist,
  useRemoveFromWatchlist,
  useTickerSearch,
  type WatchlistItem,
} from '../../api/hooks/use-watchlist';
import { useAppStore } from '../../stores/use-app-store';
import { useT, type TranslationKey } from '../../i18n';
import { getLocalizedTitle } from '../../api/hooks/use-news';
import { GlassCard } from '../common/glass-card';
import { Sparkline } from '../common/sparkline';
import { ConfirmDialog } from '../common/confirm-dialog';
import { Search, X, TrendingUp, TrendingDown, ArrowLeft, Plus, FolderPlus, Newspaper, Clock, Grid3X3, List, Columns, Pin, Building2, Target, DollarSign, BarChart3, ExternalLink, Users, FileText, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cleanTitle } from '../../utils/clean-title';
import { motion, AnimatePresence } from 'framer-motion';
import { lazy, Suspense } from 'react';

const MarketHeatmap = lazy(() => import('./market-heatmap').then(m => ({ default: m.MarketHeatmap })));
const MultiChart = lazy(() => import('./multi-chart').then(m => ({ default: m.MultiChart })));

export function StockPanel() {
  const stockPanelView = useAppStore((s) => s.stockPanelView);
  const selectedSymbol = useAppStore((s) => s.selectedSymbol);
  const setSelectedSymbol = useAppStore((s) => s.setSelectedSymbol);

  return (
    <AnimatePresence mode="wait">
      {stockPanelView === 'chart' && selectedSymbol ? (
        <motion.div key="chart" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="h-full">
          <StockChart symbol={selectedSymbol} onBack={() => setSelectedSymbol(null)} />
        </motion.div>
      ) : stockPanelView === 'heatmap' ? (
        <motion.div key="heatmap" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="h-full">
          <HeatmapWrapper />
        </motion.div>
      ) : stockPanelView === 'compare' ? (
        <motion.div key="compare" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="h-full">
          <CompareWrapper />
        </motion.div>
      ) : (
        <motion.div key="list" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="h-full">
          <WatchlistView onSelect={setSelectedSymbol} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function HeatmapWrapper() {
  const setStockPanelView = useAppStore((s) => s.setStockPanelView);
  return (
    <GlassCard
      headerRight={
        <button onClick={() => setStockPanelView('watchlist')} className="text-neutral hover:text-white transition-colors p-1">
          <List className="w-3.5 h-3.5" />
        </button>
      }
      className="h-full flex flex-col"
    >
      <MarketHeatmap />
    </GlassCard>
  );
}

function CompareWrapper() {
  const t = useT();
  const setStockPanelView = useAppStore((s) => s.setStockPanelView);
  const clearCompare = useAppStore((s) => s.clearCompare);
  return (
    <GlassCard
      headerRight={
        <div className="flex items-center gap-1">
          <button onClick={clearCompare} className="text-neutral hover:text-bearish transition-colors p-1 text-[9px] font-mono">{t('clearCompare')}</button>
          <button onClick={() => setStockPanelView('watchlist')} className="text-neutral hover:text-white transition-colors p-1">
            <List className="w-3.5 h-3.5" />
          </button>
        </div>
      }
      className="h-full flex flex-col"
    >
      <MultiChart />
    </GlassCard>
  );
}

function WatchlistView({
  onSelect,
}: {
  onSelect: (symbol: string) => void;
}) {
  const t = useT();
  const { data: allWatchlistItems } = useWatchlist();
  const [input, setInput] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [isAddingTab, setIsAddingTab] = useState(false);
  const [newTabName, setNewTabName] = useState('');
  const [flashMap, setFlashMap] = useState<Record<string, 'up' | 'down'>>({});
  const [deleteTabTarget, setDeleteTabTarget] = useState<string | null>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const prevPricesRef = useRef<Record<string, number>>({});
  const addMutation = useAddToWatchlist();
  const removeMutation = useRemoveFromWatchlist();
  const { data: suggestions } = useTickerSearch(input);

  const activeTab = useAppStore(s => s.activeWatchlistTab);
  const tabs = useAppStore(s => s.watchlistTabs);
  const tabSymbols = useAppStore(s => s.tabSymbols);
  const setActiveTab = useAppStore(s => s.setActiveWatchlistTab);
  const addTab = useAppStore(s => s.addWatchlistTab);
  const removeTab = useAppStore(s => s.removeWatchlistTab);
  const addSymbolToTab = useAppStore(s => s.addSymbolToTab);
  const removeSymbolFromTab = useAppStore(s => s.removeSymbolFromTab);
  const addToCompare = useAppStore(s => s.addToCompare);
  const compareSymbols = useAppStore(s => s.compareSymbols);
  const setStockPanelView = useAppStore(s => s.setStockPanelView);
  const addLogEntry = useAppStore(s => s.addLogEntry);

  const TAB_KEYS: Record<string, TranslationKey> = { WATCHLIST: 'watchlist', HOLDING: 'holding' };
  const tabLabel = (tab: string) => TAB_KEYS[tab] ? t(TAB_KEYS[tab]) : tab;

  // Price Flash detection
  useEffect(() => {
    if (!allWatchlistItems) return;
    const newFlashes: Record<string, 'up' | 'down'> = {};
    for (const item of allWatchlistItems) {
      if (!item.quote) continue;
      const prev = prevPricesRef.current[item.symbol];
      const curr = item.quote.price;
      if (prev !== undefined && prev !== curr) {
        const dir = curr > prev ? 'up' : 'down';
        newFlashes[item.symbol] = dir;
        addLogEntry({
          type: 'trade',
          message: `${item.symbol} ${dir === 'up' ? '▲' : '▼'} $${prev.toFixed(2)} → $${curr.toFixed(2)}`,
        });
      }
      prevPricesRef.current[item.symbol] = curr;
    }
    if (Object.keys(newFlashes).length > 0) {
      setFlashMap(newFlashes);
      const timer = setTimeout(() => setFlashMap({}), 800);
      return () => clearTimeout(timer);
    }
  }, [allWatchlistItems]);

  // Filter items based on active tab
  const filteredItems = (allWatchlistItems || []).filter(item => {
    const symbolsInTab = tabSymbols[activeTab] || [];
    // If it's the first tab (WATCHLIST), and it's empty, show everything that isn't in other tabs
    if (activeTab === 'WATCHLIST' && symbolsInTab.length === 0) {
      const otherSymbols = Object.entries(tabSymbols)
        .filter(([name]) => name !== 'WATCHLIST')
        .flatMap(([, syms]) => syms);
      return !otherSymbols.includes(item.symbol);
    }
    return symbolsInTab.includes(item.symbol);
  });

  const handleSelect = (sym: string) => {
    addMutation.mutate(sym);
    addSymbolToTab(sym, activeTab);
    setInput('');
    setShowDropdown(false);
    setHighlightIdx(-1);
  };

  const handleAddTab = () => {
    if (newTabName.trim()) {
      addTab(newTabName.trim());
      setNewTabName('');
      setIsAddingTab(false);
    }
  };

  const handleDeleteTab = (e: React.MouseEvent, tabName: string) => {
    e.stopPropagation();
    if (tabName === 'WATCHLIST' || tabName === 'HOLDING') return;
    setDeleteTabTarget(tabName);
  };

  const confirmDeleteTab = () => {
    if (deleteTabTarget) {
      removeTab(deleteTabTarget);
      setDeleteTabTarget(null);
    }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <GlassCard
      headerRight={
        <div className="flex items-center gap-1">
          <button
            onClick={() => setStockPanelView('heatmap')}
            className="p-1 text-neutral hover:text-accent transition-colors"
            title={t('heatmap')}
          >
            <Grid3X3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setStockPanelView('compare')}
            className="p-1 text-neutral hover:text-accent transition-colors relative"
            title={t('compare')}
          >
            <Columns className="w-3.5 h-3.5" />
            {compareSymbols.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-accent text-[7px] font-bold text-black flex items-center justify-center">
                {compareSymbols.length}
              </span>
            )}
          </button>
        </div>
      }
      className="h-full flex flex-col"
    >
      {/* Tab Bar */}
      <div className="flex items-center px-2 bg-black/40 border-b border-border/30 overflow-x-auto no-scrollbar shrink-0">
        <div className="flex">
          {tabs.map(tab => (
            <div key={tab} className="relative group/tab">
              <button
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all flex items-center gap-2 ${
                  activeTab === tab 
                    ? 'border-accent text-accent bg-accent/5' 
                    : 'border-transparent text-neutral hover:text-gray-300 hover:bg-white/5'
                }`}
              >
                {tabLabel(tab)}
                {tab !== 'WATCHLIST' && tab !== 'HOLDING' && (
                  <X 
                    className="w-2.5 h-2.5 opacity-0 group-hover/tab:opacity-100 hover:text-bearish transition-all" 
                    onClick={(e) => handleDeleteTab(e, tab)}
                  />
                )}
              </button>
            </div>
          ))}
        </div>
        <button 
          onClick={() => setIsAddingTab(true)}
          className="p-2 text-neutral hover:text-accent transition-colors"
          title={t('addNewTab')}
        >
          <FolderPlus className="w-3.5 h-3.5" />
        </button>
      </div>

      <AnimatePresence>
        {isAddingTab && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 py-2 bg-accent/10 border-b border-accent/20 flex gap-2 overflow-hidden"
          >
            <input 
              autoFocus
              value={newTabName}
              onChange={e => setNewTabName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddTab()}
              placeholder={t('tabNamePlaceholder')}
              className="flex-1 bg-black/40 border border-border/50 px-2 py-1 text-[10px] font-mono text-white outline-none focus:border-accent"
            />
            <button onClick={handleAddTab} className="p-1 text-accent hover:bg-accent/20">
              <Plus className="w-4 h-4" />
            </button>
            <button onClick={() => setIsAddingTab(false)} className="p-1 text-neutral hover:bg-white/10">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative px-4 py-3 border-b border-border/30 bg-black/20" ref={wrapperRef}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral" />
          <input
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value.toUpperCase());
              setShowDropdown(true);
              setHighlightIdx(-1);
            }}
            onFocus={() => input && setShowDropdown(true)}
            placeholder={t('addToTab').replace('{tab}', tabLabel(activeTab))}
            className="w-full bg-black/40 border border-border/50 pl-9 pr-3 py-1.5 text-xs font-mono text-gray-200 placeholder:text-neutral/50 outline-none focus:border-accent/50 transition-all"
            maxLength={20}
          />
        </div>

        {showDropdown && suggestions && suggestions.length > 0 && (
          <div className="absolute left-4 right-4 top-full mt-1 bg-zinc-900 border border-border/80 shadow-2xl z-50 max-h-[250px] overflow-auto backdrop-blur-xl">
            {suggestions.map((s, i) => (
              <button
                key={s.symbol}
                onMouseDown={() => handleSelect(s.symbol)}
                className="w-full text-left px-4 py-2.5 flex items-center gap-3 text-sm hover:bg-white/5 transition-colors border-b border-border/10 last:border-0"
              >
                <span className="font-mono font-black text-accent w-16">{s.symbol}</span>
                <span className="text-gray-300 truncate flex-1 font-medium">{s.name}</span>
                <span className="text-[10px] text-neutral shrink-0 font-mono">{s.exchange}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-auto flex-1 no-scrollbar">
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead>
            <tr className="text-[9px] text-neutral/50 uppercase tracking-[0.2em] bg-black/10">
              <th className="text-left px-4 py-2 font-black border-b border-border/10">{t('asset')}</th>
              <th className="text-right px-4 py-2 font-black border-b border-border/10">{t('price')}</th>
              <th className="text-right px-4 py-2 font-black border-b border-border/10">{t('change')}</th>
              <th className="text-right px-4 py-2 font-black border-b border-border/10">{t('trend')}</th>
              <th className="text-right px-2 py-2 font-black border-b border-border/10 w-[40px]"></th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {filteredItems.map((item) => {
                const q = item.quote;
                const isUp = q && q.changePercent !== null && q.changePercent >= 0;
                
                return (
                  <motion.tr
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    key={item.symbol}
                    className="hover:bg-accent/[0.03] cursor-pointer transition-all group border-b border-border/5"
                    onClick={() => onSelect(item.symbol)}
                  >
                    <td className="px-4 py-3 border-b border-border/5">
                      <div className="font-mono font-black text-white text-[13px]">{item.symbol}</div>
                      <div className="text-[10px] text-neutral truncate max-w-[140px] mt-0.5 font-medium uppercase tracking-tighter">
                        {item.name || item.symbol}
                      </div>
                    </td>
                    <td className={`text-right px-4 py-3 font-mono text-gray-200 font-bold border-b border-border/5 ${flashMap[item.symbol] === 'up' ? 'flash-up' : flashMap[item.symbol] === 'down' ? 'flash-down' : ''}`}>
                      {q ? q.price.toFixed(2) : '--'}
                    </td>
                    <td className={`text-right px-4 py-3 font-mono font-black border-b border-border/5 ${isUp ? 'text-bullish' : 'text-bearish'} ${flashMap[item.symbol] === 'up' ? 'flash-up' : flashMap[item.symbol] === 'down' ? 'flash-down' : ''}`}>
                      {q && q.changePercent !== null ? (
                        <div className="flex items-center justify-end gap-1">
                          {isUp ? '+' : ''}{q.changePercent.toFixed(2)}%
                        </div>
                      ) : '--'}
                    </td>
                    <td className="text-right px-3 py-3 border-b border-border/5">
                      {q && (
                        <div className="flex justify-end opacity-60 group-hover:opacity-100 transition-opacity">
                          <Sparkline
                            data={miniTrend(q.price, q.changePercent, q.dayHigh, q.dayLow, q.previousClose)}
                            width={60}
                            height={20}
                            color={isUp ? '#22c55e' : '#ef4444'}
                          />
                        </div>
                      )}
                    </td>
                    <td className="text-right px-2 py-3 border-b border-border/5">
                      <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCompare(item.symbol);
                          }}
                          className={`p-1.5 transition-all ${compareSymbols.includes(item.symbol) ? 'text-accent' : 'text-neutral hover:text-accent'}`}
                          title={t('pinToCompare')}
                        >
                          <Pin className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeMutation.mutate(item.symbol);
                            removeSymbolFromTab(item.symbol, activeTab);
                          }}
                          className="text-neutral hover:text-bearish transition-all p-1.5"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-neutral/40 text-[10px] font-mono uppercase tracking-[0.2em]">
                  {t('noDataInTab').replace('{tab}', tabLabel(activeTab))}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={deleteTabTarget !== null}
        title={t('deleteTabTitle')}
        description={t('deleteTabDesc')}
        confirmLabel={t('confirm')}
        cancelLabel={t('cancel')}
        variant="danger"
        onConfirm={confirmDeleteTab}
        onCancel={() => setDeleteTabTarget(null)}
      />
    </GlassCard>
  );
}

const RANGE_OPTIONS = ['1D', '5D', '1M', '3M', '6M', '1Y', 'ALL'] as const;
type RangeOption = typeof RANGE_OPTIONS[number];

const RANGE_API_MAP: Record<RangeOption, string> = {
  '1D': '1d', '5D': '5d', '1M': '1mo', '3M': '3mo', '6M': '6mo', '1Y': '1y', 'ALL': 'max',
};

type DetailTab = 'chart' | 'fundamentals' | 'financials' | 'analysts' | 'ownership';

function StockChart({ symbol, onBack }: { symbol: string; onBack: () => void }) {
  const t = useT();
  const [range, setRange] = useState<RangeOption>('1Y');
  const [detailTab, setDetailTab] = useState<DetailTab>('chart');
  const { data } = useStockDetail(symbol, { range: RANGE_API_MAP[range] });
  const { data: extData } = useStockExtended(
    (detailTab === 'analysts' || detailTab === 'ownership') ? symbol : null,
  );
  const setSelectedArticleId = useAppStore((s) => s.setSelectedArticleId);
  const addChatContext = useAppStore((s) => s.addChatContext);
  const handleAskAi = () => {
    addChatContext({ type: 'chart', symbol, label: `${symbol} Chart` });
  };

  const recs = data?.recommendations || [];

  const q = data?.quote;
  const p = data?.profile;

  return (
    <GlassCard
      title={
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1 -ml-1 text-neutral hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-white">{symbol}</span>
              {q && <span className="text-gray-400 font-mono text-[11px]">${q.price.toFixed(2)}</span>}
            </div>
            {(q?.name || p?.sector) && (
              <div className="text-[8px] font-mono text-neutral/50 uppercase tracking-wider">
                {q?.name}{p?.sector ? ` · ${p.sector}` : ''}
              </div>
            )}
          </div>
        </div>
      }
      headerRight={
        <div className="flex items-center gap-2">
          <button
            onClick={handleAskAi}
            className="text-[9px] font-mono font-bold text-ai/70 hover:text-ai uppercase tracking-tighter px-1.5 py-0.5 border border-ai/20 hover:border-ai/50 transition-colors"
            title={t('askAiChartTitle')}
          >
            {t('askAiChart')}
          </button>
          {(() => {
            const cp = q?.changePercent;
            if (cp === null || cp === undefined) return null;
            const isUp = cp >= 0;
            return (
              <div className={`flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-mono font-black ${
                isUp ? 'bg-bullish/10 text-bullish border border-bullish/20' : 'bg-bearish/10 text-bearish border border-bearish/20'
              }`}>
                {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {isUp ? '+' : ''}{cp.toFixed(2)}%
              </div>
            );
          })()}
        </div>
      }
      className="h-full"
    >
      {/* Detail Tabs */}
      <div className="shrink-0 flex items-center border-b border-border/30 bg-black/20">
        {(['chart', 'fundamentals', 'financials', 'analysts', 'ownership'] as DetailTab[]).map((tab) => {
          const labelMap: Record<DetailTab, string> = {
            chart: t('chartTab'),
            fundamentals: t('profileTab'),
            financials: t('financialsTab'),
            analysts: t('analystsTab'),
            ownership: t('ownershipTab'),
          };
          return (
            <button
              key={tab}
              onClick={() => setDetailTab(tab)}
              className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest border-b-2 transition-all ${
                detailTab === tab
                  ? 'border-accent text-accent'
                  : 'border-transparent text-neutral hover:text-gray-300'
              }`}
            >
              {labelMap[tab]}
            </button>
          );
        })}
      </div>

      {detailTab === 'chart' && (
        <div className="flex-1 min-h-0">
          <ChartWithIndicators symbol={symbol} range={range} onRangeChange={(r) => setRange(r as RangeOption)} />
        </div>
      )}

      {detailTab === 'fundamentals' && (
        <div className="flex-1 overflow-auto no-scrollbar">
          <FundamentalsView quote={q} profile={p} />
        </div>
      )}

      {detailTab === 'financials' && (
        <div className="flex-1 overflow-auto no-scrollbar">
          <FinancialsView quote={q} profile={p} />
        </div>
      )}

      {detailTab === 'analysts' && (
        <div className="flex-1 overflow-auto no-scrollbar">
          <AnalystsView extended={extData?.extended ?? null} quote={q} profile={p} />
        </div>
      )}

      {detailTab === 'ownership' && (
        <div className="flex-1 overflow-auto no-scrollbar">
          <OwnershipView extended={extData?.extended ?? null} insiders={extData?.insiders ?? []} />
        </div>
      )}

      {/* Key Stats Bar (chart tab only) */}
      {detailTab === 'chart' && q && (
        <div className="shrink-0 border-t border-border/30 bg-black/20">
          <div className="grid grid-cols-4">
            <StatCell label={t('mktCap')} value={formatCompact(q.marketCap)} />
            <StatCell label={t('peLabel')} value={q.pe != null ? q.pe.toFixed(2) : '--'} />
            <StatCell label={t('epsLabel')} value={q.eps != null ? `$${q.eps.toFixed(2)}` : '--'} />
            <StatCell label={t('betaLabel')} value={q.beta != null ? q.beta.toFixed(2) : '--'} />
          </div>
          <div className="grid grid-cols-4 border-t border-border/10">
            <StatCell label={t('volume')} value={formatCompact(q.volume)} />
            <StatCell label={t('avgVol')} value={formatCompact(q.avgVolume)} />
            <StatCell
              label={t('fiftyTwoWeekRange')}
              value={q.fiftyTwoWeekLow != null && q.fiftyTwoWeekHigh != null
                ? `${q.fiftyTwoWeekLow.toFixed(0)}–${q.fiftyTwoWeekHigh.toFixed(0)}`
                : '--'}
            />
            <StatCell
              label={t('dayRange')}
              value={q.dayLow != null && q.dayHigh != null
                ? `${q.dayLow.toFixed(2)}–${q.dayHigh.toFixed(2)}`
                : '--'}
            />
          </div>
        </div>
      )}

      {/* Related News (chart tab only) */}
      {detailTab === 'chart' && recs.length > 0 && (
        <div className="shrink-0 border-t border-border/30 flex flex-col max-h-[35%]">
          <div className="flex items-center gap-2 px-4 py-1.5 bg-black/30 border-b border-border/20 shrink-0">
            <Newspaper className="w-3 h-3 text-accent" />
            <span className="text-[9px] font-black uppercase tracking-widest text-neutral">{t('signals')}</span>
            <span className="text-[8px] font-mono text-neutral/50 ml-auto">{recs.length}</span>
          </div>
          <div className="overflow-y-auto no-scrollbar flex-1">
            {recs.map((rec) => (
              <button
                key={rec.id}
                onClick={() => setSelectedArticleId(rec.article.id)}
                className="w-full text-left px-4 py-2 flex items-start gap-2.5 hover:bg-accent/[0.04] transition-colors border-b border-border/10 last:border-0 group"
              >
                <span
                  className="shrink-0 mt-0.5 inline-block px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wider border"
                  style={{
                    backgroundColor: getActionColor(rec.action) + '15',
                    color: getActionColor(rec.action),
                    borderColor: getActionColor(rec.action) + '30',
                  }}
                >
                  {rec.action}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-gray-300 leading-snug line-clamp-2 group-hover:text-white">
                    {cleanTitle(getLocalizedTitle(rec.article))}
                  </p>
                  <span className="text-[8px] font-mono text-neutral/40">
                    {new Date(rec.article.scrapedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </GlassCard>
  );
}

// ── Bloomberg-style Fundamentals View ──
function FundamentalsView({ quote: q, profile: p }: { quote: StockQuote | null | undefined; profile: StockProfile | null | undefined }) {
  const t = useT();
  return (
    <div className="p-3 space-y-3">
      {/* Company Info */}
      {p && (p.sector || p.industry) && (
        <Section icon={<Building2 className="w-3 h-3" />} title={t('companySection')}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <KV label={t('sector')} value={p.sector} />
            <KV label={t('industry')} value={p.industry} />
            <KV label={t('employeesLabel')} value={p.employees != null ? formatCompact(p.employees) : null} />
            <KV label={t('hqLabel')} value={p.city && p.country ? `${p.city}, ${p.country}` : p.country} />
          </div>
          {p.website && (
            <a href={p.website} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-1.5 text-[9px] font-mono text-accent/70 hover:text-accent">
              <ExternalLink className="w-2.5 h-2.5" />{p.website.replace(/^https?:\/\/(www\.)?/, '')}
            </a>
          )}
          {p.description && (
            <p className="mt-2 text-[9px] font-mono text-neutral/60 leading-relaxed line-clamp-4">
              {p.description}
            </p>
          )}
        </Section>
      )}

      {/* Analyst Targets */}
      {p && p.targetMeanPrice != null && (
        <Section icon={<Target className="w-3 h-3" />} title={t('analystConsensus')}>
          <div className="grid grid-cols-3 gap-x-4 gap-y-1">
            <KV label={t('targetLow')} value={`$${p.targetLowPrice?.toFixed(2)}`} />
            <KV label={t('targetMean')} value={`$${p.targetMeanPrice?.toFixed(2)}`} accent />
            <KV label={t('targetHigh')} value={`$${p.targetHighPrice?.toFixed(2)}`} />
          </div>
          {q?.price && p.targetMeanPrice && (
            <div className="mt-2">
              <TargetBar current={q.price} low={p.targetLowPrice} mean={p.targetMeanPrice} high={p.targetHighPrice} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
            <KV label={t('recommendationLabel')} value={p.recommendationKey?.toUpperCase()} />
            <KV label={t('numAnalysts')} value={p.numberOfAnalysts?.toString()} />
          </div>
        </Section>
      )}

      {/* Valuation */}
      <Section icon={<DollarSign className="w-3 h-3" />} title={t('valuationSection')}>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <KV label={t('peTtm')} value={q?.pe != null ? q.pe.toFixed(2) : null} />
          <KV label={t('peFwd')} value={q?.forwardPE != null ? q.forwardPE.toFixed(2) : null} />
          <KV label={t('pbLabel')} value={q?.priceToBook != null ? q.priceToBook.toFixed(2) : null} />
          <KV label={t('bookValueLabel')} value={q?.bookValue != null ? `$${q.bookValue.toFixed(2)}` : null} />
          <KV label={t('epsTtm')} value={q?.eps != null ? `$${q.eps.toFixed(2)}` : null} />
          <KV label={t('epsFwd')} value={q?.epsForward != null ? `$${q.epsForward.toFixed(2)}` : null} />
        </div>
      </Section>

      {/* Trading Data */}
      <Section icon={<BarChart3 className="w-3 h-3" />} title={t('tradingSection')}>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <KV label={t('openLabel')} value={q?.open != null ? `$${q.open.toFixed(2)}` : null} />
          <KV label={t('prevClose')} value={q?.previousClose != null ? `$${q.previousClose.toFixed(2)}` : null} />
          <KV label={t('fiftyDayAvg')} value={q?.fiftyDayAvg != null ? `$${q.fiftyDayAvg.toFixed(2)}` : null} />
          <KV label={t('twoHundredDayAvg')} value={q?.twoHundredDayAvg != null ? `$${q.twoHundredDayAvg.toFixed(2)}` : null} />
          <KV label={t('betaLabel')} value={q?.beta != null ? q.beta.toFixed(2) : null} />
          <KV label={t('shortRatioLabel')} value={q?.shortRatio != null ? q.shortRatio.toFixed(2) : null} />
          <KV label={t('sharesOut')} value={formatCompact(q?.sharesOutstanding)} />
          <KV label={t('floatLabel')} value={formatCompact(q?.floatShares)} />
          <KV label={t('divYield')} value={q?.dividendYield != null ? `${(q.dividendYield * 100).toFixed(2)}%` : null} />
          <KV label={t('divRate')} value={q?.dividendRate != null ? `$${q.dividendRate.toFixed(2)}` : null} />
          {q?.earningsDate && <KV label={t('earningsLabel')} value={new Date(q.earningsDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} />}
        </div>
      </Section>
    </div>
  );
}

// ── Bloomberg-style Financials View ──
function FinancialsView({ quote: _q, profile: p }: { quote: StockQuote | null | undefined; profile: StockProfile | null | undefined }) {
  const t = useT();
  if (!p) {
    return (
      <div className="flex items-center justify-center h-full text-[10px] font-mono text-neutral/40 uppercase">
        {t('noFinancialData')}
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
      {/* Profitability */}
      <Section icon={<TrendingUp className="w-3 h-3" />} title={t('profitability')}>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <KV label={t('profitMargin')} value={fmtPct(p.profitMargins)} />
          <KV label={t('roe')} value={fmtPct(p.returnOnEquity)} />
          <KV label={t('roa')} value={fmtPct(p.returnOnAssets)} />
          <KV label={t('revGrowth')} value={fmtPct(p.revenueGrowth)} />
          <KV label={t('earningsGrowthLabel')} value={fmtPct(p.earningsGrowth)} />
        </div>
      </Section>

      {/* Income & Revenue */}
      <Section icon={<DollarSign className="w-3 h-3" />} title={t('incomeStatement')}>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <KV label={t('revenueLabel')} value={formatCompact(p.totalRevenue)} />
          <KV label={t('grossProfit')} value={formatCompact(p.grossProfit)} />
          <KV label={t('ebitdaLabel')} value={formatCompact(p.ebitda)} />
          <KV label={t('freeCashFlow')} value={formatCompact(p.freeCashflow)} />
          <KV label={t('opCashFlow')} value={formatCompact(p.operatingCashflow)} />
        </div>
      </Section>

      {/* Balance Sheet */}
      <Section icon={<BarChart3 className="w-3 h-3" />} title={t('balanceSheet')}>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <KV label={t('totalCash')} value={formatCompact(p.totalCash)} />
          <KV label={t('totalDebtLabel')} value={formatCompact(p.totalDebt)} />
          <KV label={t('deRatio')} value={p.debtToEquity != null ? p.debtToEquity.toFixed(2) : null} />
          <KV label={t('currentRatioLabel')} value={p.currentRatio != null ? p.currentRatio.toFixed(2) : null} />
        </div>
        {p.totalCash != null && p.totalDebt != null && (
          <div className="mt-2">
            <CashDebtBar cash={p.totalCash} debt={p.totalDebt} cashLabel={t('cashLabel')} debtLabel={t('debtLabel')} />
          </div>
        )}
      </Section>
    </div>
  );
}

// ── Analysts View ──
function AnalystsView({ extended, quote: q, profile: p }: { extended: ExtendedStockData | null; quote: StockQuote | null | undefined; profile: StockProfile | null | undefined }) {
  const t = useT();

  if (!extended) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-4 h-4 border-2 border-accent/30 border-t-accent animate-spin" />
      </div>
    );
  }

  const hasData = extended.recommendationTrend.length > 0 || extended.earningsHistory.length > 0 || extended.upgradeDowngradeHistory.length > 0;
  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-full text-[10px] font-mono text-neutral/40 uppercase">
        {t('noAnalystData')}
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
      {/* Analyst Targets (from profile) */}
      {p && p.targetMeanPrice != null && (
        <Section icon={<Target className="w-3 h-3" />} title={t('analystConsensus')}>
          <div className="grid grid-cols-3 gap-x-4 gap-y-1">
            <KV label={t('targetLow')} value={`$${p.targetLowPrice?.toFixed(2)}`} />
            <KV label={t('targetMean')} value={`$${p.targetMeanPrice?.toFixed(2)}`} accent />
            <KV label={t('targetHigh')} value={`$${p.targetHighPrice?.toFixed(2)}`} />
          </div>
          {q?.price && p.targetMeanPrice && (
            <div className="mt-2">
              <TargetBar current={q.price} low={p.targetLowPrice} mean={p.targetMeanPrice} high={p.targetHighPrice} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
            <KV label={t('recommendationLabel')} value={p.recommendationKey?.toUpperCase()} />
            <KV label={t('numAnalysts')} value={p.numberOfAnalysts?.toString()} />
          </div>
        </Section>
      )}

      {/* Recommendation Trend */}
      {extended.recommendationTrend.length > 0 && (
        <Section icon={<BarChart3 className="w-3 h-3" />} title={t('recTrend')}>
          <RecTrendChart data={extended.recommendationTrend} />
        </Section>
      )}

      {/* EPS History (Beat/Miss) */}
      {extended.earningsHistory.length > 0 && (
        <Section icon={<DollarSign className="w-3 h-3" />} title={t('epsHistory')}>
          <div className="space-y-0.5">
            <div className="grid grid-cols-[1fr_60px_60px_60px] gap-1 text-[7px] font-mono text-neutral/40 uppercase tracking-wider px-1">
              <span>Q</span>
              <span className="text-right">{t('estimate')}</span>
              <span className="text-right">{t('actual')}</span>
              <span className="text-right">{t('surprise')}</span>
            </div>
            {extended.earningsHistory.map((e, i) => {
              const beat = e.epsDifference != null ? e.epsDifference > 0 : null;
              return (
                <div key={i} className="grid grid-cols-[1fr_60px_60px_60px] gap-1 px-1 py-0.5 text-[9px] font-mono hover:bg-white/[0.02]">
                  <span className="text-neutral/60">{e.quarter}</span>
                  <span className="text-right text-neutral/50">{e.epsEstimate != null ? `$${e.epsEstimate.toFixed(2)}` : '--'}</span>
                  <span className={`text-right font-bold ${beat === true ? 'text-bullish' : beat === false ? 'text-bearish' : 'text-gray-300'}`}>
                    {e.epsActual != null ? `$${e.epsActual.toFixed(2)}` : '--'}
                  </span>
                  <span className={`text-right ${beat === true ? 'text-bullish' : beat === false ? 'text-bearish' : 'text-neutral/40'}`}>
                    {e.surprisePercent != null ? `${e.surprisePercent > 0 ? '+' : ''}${(e.surprisePercent * 100).toFixed(1)}%` : '--'}
                  </span>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Earnings Estimates */}
      {extended.earningsTrend.length > 0 && (
        <Section icon={<TrendingUp className="w-3 h-3" />} title={t('earningsEstimates')}>
          <div className="space-y-0.5">
            <div className="grid grid-cols-[80px_1fr_1fr_1fr_60px] gap-1 text-[7px] font-mono text-neutral/40 uppercase tracking-wider px-1">
              <span>Period</span>
              <span className="text-right">Low</span>
              <span className="text-right">Avg</span>
              <span className="text-right">High</span>
              <span className="text-right"># Est</span>
            </div>
            {extended.earningsTrend.map((e, i) => (
              <div key={i} className="grid grid-cols-[80px_1fr_1fr_1fr_60px] gap-1 px-1 py-0.5 text-[9px] font-mono hover:bg-white/[0.02]">
                <span className="text-neutral/60">{e.period}</span>
                <span className="text-right text-neutral/50">{e.earningsEstimate.low != null ? `$${e.earningsEstimate.low.toFixed(2)}` : '--'}</span>
                <span className="text-right text-gray-300 font-bold">{e.earningsEstimate.avg != null ? `$${e.earningsEstimate.avg.toFixed(2)}` : '--'}</span>
                <span className="text-right text-neutral/50">{e.earningsEstimate.high != null ? `$${e.earningsEstimate.high.toFixed(2)}` : '--'}</span>
                <span className="text-right text-neutral/40">{e.earningsEstimate.numberOfAnalysts ?? '--'}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Upgrade/Downgrade History */}
      {extended.upgradeDowngradeHistory.length > 0 && (
        <Section icon={<ArrowUpRight className="w-3 h-3" />} title={t('upgradeDowngrade')}>
          <div className="space-y-0.5 max-h-[200px] overflow-y-auto no-scrollbar">
            {extended.upgradeDowngradeHistory.map((u, i) => {
              const isUpgrade = u.action.toLowerCase().includes('upgrade') || u.action.toLowerCase() === 'init' || u.action.toLowerCase() === 'reiterated';
              const isDowngrade = u.action.toLowerCase().includes('downgrade');
              return (
                <div key={i} className="flex items-center gap-2 px-1 py-1 text-[9px] font-mono hover:bg-white/[0.02] border-b border-border/10 last:border-0">
                  <span className="text-neutral/40 w-[65px] shrink-0">{u.date}</span>
                  <span className={`w-3 h-3 shrink-0 ${isUpgrade ? 'text-bullish' : isDowngrade ? 'text-bearish' : 'text-neutral/40'}`}>
                    {isUpgrade ? <ArrowUpRight className="w-3 h-3" /> : isDowngrade ? <ArrowDownRight className="w-3 h-3" /> : null}
                  </span>
                  <span className="text-gray-300 truncate flex-1">{u.firm}</span>
                  <span className="text-neutral/50 shrink-0">{u.fromGrade || '--'}</span>
                  <span className="text-neutral/30 shrink-0">&rarr;</span>
                  <span className={`font-bold shrink-0 ${isUpgrade ? 'text-bullish' : isDowngrade ? 'text-bearish' : 'text-gray-300'}`}>{u.toGrade || '--'}</span>
                </div>
              );
            })}
          </div>
        </Section>
      )}
    </div>
  );
}

// ── Recommendation Trend Chart ──
function RecTrendChart({ data }: { data: ExtendedStockData['recommendationTrend'] }) {
  const t = useT();
  if (data.length === 0) return null;

  // Reverse so oldest is on left
  const items = [...data].reverse();
  const maxTotal = Math.max(...items.map(d => d.strongBuy + d.buy + d.hold + d.sell + d.strongSell), 1);

  return (
    <div className="space-y-1">
      <div className="flex gap-1 items-end h-[60px]">
        {items.map((d, i) => {
          const total = d.strongBuy + d.buy + d.hold + d.sell + d.strongSell;
          if (total === 0) return <div key={i} className="flex-1" />;
          const h = (total / maxTotal) * 60;
          return (
            <div key={i} className="flex-1 flex flex-col justify-end" style={{ height: 60 }}>
              <div className="flex flex-col overflow-hidden" style={{ height: h }}>
                {d.strongBuy > 0 && <div className="bg-bullish" style={{ height: `${(d.strongBuy / total) * 100}%` }} />}
                {d.buy > 0 && <div className="bg-bullish/60" style={{ height: `${(d.buy / total) * 100}%` }} />}
                {d.hold > 0 && <div className="bg-neutral/40" style={{ height: `${(d.hold / total) * 100}%` }} />}
                {d.sell > 0 && <div className="bg-bearish/60" style={{ height: `${(d.sell / total) * 100}%` }} />}
                {d.strongSell > 0 && <div className="bg-bearish" style={{ height: `${(d.strongSell / total) * 100}%` }} />}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-1">
        {items.map((d, i) => (
          <div key={i} className="flex-1 text-center text-[7px] font-mono text-neutral/40">{d.period}</div>
        ))}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-3 justify-center mt-1">
        {[
          { color: 'bg-bullish', label: t('strongBuy') },
          { color: 'bg-bullish/60', label: t('buy') },
          { color: 'bg-neutral/40', label: 'Hold' },
          { color: 'bg-bearish/60', label: t('sell') },
          { color: 'bg-bearish', label: t('strongSell') },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1">
            <div className={`w-2 h-2 ${l.color}`} />
            <span className="text-[7px] font-mono text-neutral/40">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Ownership View ──
function OwnershipView({ extended, insiders }: { extended: ExtendedStockData | null; insiders: InsiderTransaction[] }) {
  const t = useT();

  if (!extended) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-4 h-4 border-2 border-accent/30 border-t-accent animate-spin" />
      </div>
    );
  }

  const mh = extended.majorHolders;
  const ks = extended.keyStats;
  const hasData = mh || insiders.length > 0 || extended.secFilings.length > 0;

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-full text-[10px] font-mono text-neutral/40 uppercase">
        {t('noOwnershipData')}
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
      {/* Ownership Breakdown */}
      {mh && (mh.insidersPercentHeld != null || mh.institutionsPercentHeld != null) && (
        <Section icon={<Users className="w-3 h-3" />} title={t('ownershipBreakdown')}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <KV label={t('insiders')} value={fmtPct(mh.insidersPercentHeld)} />
            <KV label={t('institutions')} value={fmtPct(mh.institutionsPercentHeld)} />
            <KV label={t('floatHeld')} value={fmtPct(mh.institutionsFloatPercentHeld)} />
            <KV label={t('instCount')} value={mh.institutionsCount != null ? formatCompact(mh.institutionsCount) : null} />
          </div>
          {mh.insidersPercentHeld != null && mh.institutionsPercentHeld != null && (
            <div className="mt-2">
              <OwnershipBar insider={mh.insidersPercentHeld} inst={mh.institutionsPercentHeld} />
            </div>
          )}
        </Section>
      )}

      {/* Short Interest */}
      {ks && (ks.shortPercentOfFloat != null || ks.sharesShort != null) && (
        <Section icon={<TrendingDown className="w-3 h-3" />} title={t('shortInterest')}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <KV label={t('shortFloat')} value={fmtPct(ks.shortPercentOfFloat)} />
            <KV label={t('sharesShort')} value={formatCompact(ks.sharesShort)} />
            <KV label={t('shortPriorMonth')} value={formatCompact(ks.sharesShortPriorMonth)} />
            <KV label={t('shortDate')} value={ks.dateShortInterest} />
          </div>
        </Section>
      )}

      {/* Key Stats extras */}
      {ks && (ks.enterpriseValue != null || ks.pegRatio != null) && (
        <Section icon={<BarChart3 className="w-3 h-3" />} title="Key Statistics">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <KV label={t('evLabel')} value={formatCompact(ks.enterpriseValue)} />
            <KV label={t('pegLabel')} value={ks.pegRatio != null ? ks.pegRatio.toFixed(2) : null} />
            <KV label={t('fiftyTwoWkChg')} value={fmtPct(ks.fiftyTwoWeekChange)} />
            <KV label={t('sp500Chg')} value={fmtPct(ks.sp500FiftyTwoWeekChange)} />
          </div>
        </Section>
      )}

      {/* Insider Transactions */}
      {insiders.length > 0 && (
        <Section icon={<Users className="w-3 h-3" />} title={t('insiderTransactions')}>
          <div className="space-y-0.5 max-h-[200px] overflow-y-auto no-scrollbar">
            {insiders.map((tx, i) => {
              const isPurchase = tx.transactionType === 'P';
              const isSale = tx.transactionType === 'S';
              return (
                <div key={i} className="flex items-center gap-2 px-1 py-1 text-[9px] font-mono hover:bg-white/[0.02] border-b border-border/10 last:border-0">
                  <span className="text-neutral/40 w-[65px] shrink-0">{tx.transactionDate}</span>
                  <span className={`text-[7px] font-black uppercase px-1 py-0.5 border shrink-0 ${
                    isPurchase ? 'text-bullish border-bullish/30 bg-bullish/10' :
                    isSale ? 'text-bearish border-bearish/30 bg-bearish/10' :
                    'text-neutral/50 border-border/30 bg-white/5'
                  }`}>
                    {isPurchase ? t('purchase') : isSale ? t('sale') : t('award')}
                  </span>
                  <span className="text-gray-300 truncate flex-1">{tx.ownerName}</span>
                  <span className="text-neutral/50 shrink-0">{formatCompact(tx.shares)}</span>
                  {tx.value != null && <span className="text-neutral/40 shrink-0">${formatCompact(tx.value)}</span>}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* SEC Filings */}
      {extended.secFilings.length > 0 && (
        <Section icon={<FileText className="w-3 h-3" />} title={t('filings')}>
          <div className="space-y-0.5 max-h-[200px] overflow-y-auto no-scrollbar">
            {extended.secFilings.map((f, i) => (
              <a
                key={i}
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-1 py-1 text-[9px] font-mono hover:bg-white/[0.02] border-b border-border/10 last:border-0 group"
              >
                <span className="text-neutral/40 w-[65px] shrink-0">{f.date}</span>
                <span className="text-accent/70 font-bold shrink-0 w-[50px]">{f.type}</span>
                <span className="text-gray-300 truncate flex-1 group-hover:text-accent transition-colors">{f.title}</span>
                <ExternalLink className="w-2.5 h-2.5 text-neutral/30 group-hover:text-accent shrink-0" />
              </a>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function OwnershipBar({ insider, inst }: { insider: number; inst: number }) {
  const t = useT();
  const other = Math.max(0, 1 - insider - inst);
  return (
    <div className="space-y-1">
      <div className="flex h-1.5 overflow-hidden">
        <div className="bg-accent/60" style={{ width: `${insider * 100}%` }} />
        <div className="bg-bullish/60" style={{ width: `${inst * 100}%` }} />
        <div className="bg-neutral/20" style={{ width: `${other * 100}%` }} />
      </div>
      <div className="flex justify-between text-[7px] font-mono text-neutral/40">
        <span>{t('insiders')} {(insider * 100).toFixed(1)}%</span>
        <span>{t('institutions')} {(inst * 100).toFixed(1)}%</span>
      </div>
    </div>
  );
}

// ── Reusable sub-components ──

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border/20 bg-black/20">
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border/20 bg-black/30">
        <span className="text-accent/60">{icon}</span>
        <span className="text-[9px] font-black uppercase tracking-widest text-neutral">{title}</span>
      </div>
      <div className="px-3 py-2">{children}</div>
    </div>
  );
}

function KV({ label, value, accent }: { label: string; value: string | null | undefined; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between py-0.5">
      <span className="text-[8px] font-mono text-neutral/50 uppercase tracking-wider">{label}</span>
      <span className={`text-[10px] font-mono font-bold ${accent ? 'text-accent' : 'text-gray-300'}`}>
        {value || '--'}
      </span>
    </div>
  );
}

function TargetBar({ current, low, mean, high }: { current: number; low: number | null; mean: number; high: number | null }) {
  const lo = low ?? mean * 0.8;
  const hi = high ?? mean * 1.2;
  const range = hi - lo || 1;
  const pctCurrent = Math.max(0, Math.min(100, ((current - lo) / range) * 100));
  const pctMean = Math.max(0, Math.min(100, ((mean - lo) / range) * 100));

  return (
    <div className="relative h-2 bg-white/5 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-bearish/30 via-neutral/10 to-bullish/30" />
      <div className="absolute top-0 bottom-0 w-0.5 bg-accent" style={{ left: `${pctMean}%` }} title={`Target: $${mean.toFixed(2)}`} />
      <div className="absolute top-0 bottom-0 w-1 bg-white" style={{ left: `${pctCurrent}%`, transform: 'translateX(-50%)' }} title={`Current: $${current.toFixed(2)}`} />
    </div>
  );
}

function CashDebtBar({ cash, debt, cashLabel, debtLabel }: { cash: number; debt: number; cashLabel: string; debtLabel: string }) {
  const total = cash + debt || 1;
  const cashPct = (cash / total) * 100;
  return (
    <div className="space-y-1">
      <div className="flex h-1.5 overflow-hidden">
        <div className="bg-bullish/60" style={{ width: `${cashPct}%` }} />
        <div className="bg-bearish/60" style={{ width: `${100 - cashPct}%` }} />
      </div>
      <div className="flex justify-between text-[7px] font-mono text-neutral/40">
        <span>{cashLabel} {formatCompact(cash)}</span>
        <span>{debtLabel} {formatCompact(debt)}</span>
      </div>
    </div>
  );
}

function fmtPct(v: number | null | undefined): string | null {
  if (v == null) return null;
  return `${(v * 100).toFixed(2)}%`;
}

function getActionColor(action: string) {
  switch (action) {
    case 'BUY': return '#22c55e';
    case 'SELL': return '#ef4444';
    case 'HOLD': return '#3b82f6';
    case 'WATCH': return '#f97316';
    default: return '#a1a1aa';
  }
}

function formatCompact(n: number | null | undefined): string {
  if (n == null) return '--';
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toLocaleString();
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-2 border-r border-border/20 last:border-r-0 text-center">
      <div className="text-[8px] font-black uppercase tracking-[0.15em] text-neutral/50">{label}</div>
      <div className="text-[11px] font-mono font-bold text-gray-300 mt-0.5">{value}</div>
    </div>
  );
}

function miniTrend(
  price: number,
  changePercent: number | null,
  dayHigh: number | null,
  dayLow: number | null,
  previousClose: number | null,
): number[] {
  const prev = previousClose ?? price;
  const low = dayLow ?? Math.min(prev, price);
  const high = dayHigh ?? Math.max(prev, price);
  const mid = (prev + price) / 2;
  const cp = changePercent ?? 0;
  if (cp >= 0) {
    return [prev, prev * 0.998, low, mid, high * 0.999, price];
  } else {
    return [prev, prev * 1.002, high, mid, low * 1.001, price];
  }
}
