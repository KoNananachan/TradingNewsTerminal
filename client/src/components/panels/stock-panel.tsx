import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, type IChartApi, ColorType } from 'lightweight-charts';
import { useStockDetail } from '../../api/hooks/use-stocks';
import {
  useWatchlist,
  useAddToWatchlist,
  useRemoveFromWatchlist,
  useTickerSearch,
  type WatchlistItem,
} from '../../api/hooks/use-watchlist';
import { useAppStore } from '../../stores/use-app-store';
import { GlassCard } from '../common/glass-card';
import { Sparkline } from '../common/sparkline';
import { Search, X, TrendingUp, TrendingDown, ArrowLeft, Plus, FolderPlus, Newspaper, Clock, Grid3X3, List, Columns, Pin } from 'lucide-react';
import { cleanTitle } from '../../utils/clean-title';
import { motion, AnimatePresence } from 'framer-motion';
import { MarketHeatmap } from './market-heatmap';
import { MultiChart } from './multi-chart';

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
  const setStockPanelView = useAppStore((s) => s.setStockPanelView);
  const clearCompare = useAppStore((s) => s.clearCompare);
  return (
    <GlassCard
      headerRight={
        <div className="flex items-center gap-1">
          <button onClick={clearCompare} className="text-neutral hover:text-bearish transition-colors p-1 text-[9px] font-mono">Clear</button>
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
  const { data: allWatchlistItems } = useWatchlist();
  const [input, setInput] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [isAddingTab, setIsAddingTab] = useState(false);
  const [newTabName, setNewTabName] = useState('');
  const [flashMap, setFlashMap] = useState<Record<string, 'up' | 'down'>>({});

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
    if (confirm(`Are you sure you want to delete the tab "${tabName}"?`)) {
      removeTab(tabName);
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
            title="Heatmap"
          >
            <Grid3X3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setStockPanelView('compare')}
            className="p-1 text-neutral hover:text-accent transition-colors relative"
            title="Compare"
          >
            <Columns className="w-3.5 h-3.5" />
            {compareSymbols.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-accent rounded-full text-[7px] font-bold text-black flex items-center justify-center">
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
                {tab}
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
          title="Add New Tab"
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
              placeholder="Tab Name..."
              className="flex-1 bg-black/40 border border-border/50 rounded px-2 py-1 text-[10px] font-mono text-white outline-none focus:border-accent"
            />
            <button onClick={handleAddTab} className="p-1 text-accent hover:bg-accent/20 rounded">
              <Plus className="w-4 h-4" />
            </button>
            <button onClick={() => setIsAddingTab(false)} className="p-1 text-neutral hover:bg-white/10 rounded">
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
            placeholder={`Add to ${activeTab}...`}
            className="w-full bg-black/40 border border-border/50 rounded-md pl-9 pr-3 py-1.5 text-xs font-mono text-gray-200 placeholder:text-neutral/50 outline-none focus:border-accent/50 transition-all"
            maxLength={20}
          />
        </div>

        {showDropdown && suggestions && suggestions.length > 0 && (
          <div className="absolute left-4 right-4 top-full mt-1 bg-zinc-900 border border-border/80 rounded-lg shadow-2xl z-50 max-h-[250px] overflow-auto backdrop-blur-xl">
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
              <th className="text-left px-4 py-2 font-black border-b border-border/10">Asset</th>
              <th className="text-right px-4 py-2 font-black border-b border-border/10">Price</th>
              <th className="text-right px-4 py-2 font-black border-b border-border/10">Change</th>
              <th className="text-right px-4 py-2 font-black border-b border-border/10">Trend</th>
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
                          title="Pin to Compare"
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
                  No data points in {activeTab}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}

function StockChart({ symbol, onBack }: { symbol: string; onBack: () => void }) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const { data } = useStockDetail(symbol);
  const setSelectedArticleId = useAppStore((s) => s.setSelectedArticleId);

  useEffect(() => {
    if (!chartContainerRef.current || !data?.history?.length) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#a1a1aa',
        fontSize: 11,
        fontFamily: 'JetBrains Mono',
      },
      grid: {
        vertLines: { color: 'rgba(63,63,70,0.1)' },
        horzLines: { color: 'rgba(63,63,70,0.1)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      crosshair: {
        horzLine: { color: '#22c55e', labelBackgroundColor: '#22c55e' },
        vertLine: { color: '#22c55e', labelBackgroundColor: '#22c55e' },
      },
      timeScale: { borderColor: 'rgba(63,63,70,0.3)' },
      rightPriceScale: { borderColor: 'rgba(63,63,70,0.3)' },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e88',
      wickDownColor: '#ef444488',
    });

    candleSeries.setData(
      data.history.map((h) => ({
        time: h.time as any,
        open: h.open,
        high: h.high,
        low: h.low,
        close: h.close,
      })),
    );

    chart.timeScale().fitContent();
    chartRef.current = chart;

    const ro = new ResizeObserver(() => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    });
    ro.observe(chartContainerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [data]);

  const recs = data?.recommendations || [];

  return (
    <GlassCard
      title={
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1 -ml-1 text-neutral hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="font-mono font-black text-white">{symbol}</span>
          {data?.quote && (
            <span className="text-gray-400 font-mono text-[11px]">${data.quote.price.toFixed(2)}</span>
          )}
        </div>
      }
      headerRight={
        (() => {
          const cp = data?.quote?.changePercent;
          if (cp === null || cp === undefined) return undefined;
          const isUp = cp >= 0;
          return (
            <div className={`flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-mono font-black ${
              isUp ? 'bg-bullish/10 text-bullish border border-bullish/20' : 'bg-bearish/10 text-bearish border border-bearish/20'
            }`}>
              {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(cp).toFixed(2)}%
            </div>
          );
        })()
      }
      className="h-full"
    >
      <div ref={chartContainerRef} className="flex-1 min-h-0 w-full" />

      {/* Key Stats */}
      {data?.quote && (
        <div className="shrink-0 grid grid-cols-4 border-t border-border/30 bg-black/20">
          <StatCell label="Mkt Cap" value={formatCompact(data.quote.marketCap)} />
          <StatCell label="Volume" value={formatCompact(data.quote.volume)} />
          <StatCell
            label="Day Range"
            value={data.quote.dayLow != null && data.quote.dayHigh != null
              ? `${data.quote.dayLow.toFixed(2)} – ${data.quote.dayHigh.toFixed(2)}`
              : '--'}
          />
          <StatCell label="Prev Close" value={data.quote.previousClose?.toFixed(2) ?? '--'} />
        </div>
      )}

      {/* Related News */}
      {recs.length > 0 && (
        <div className="shrink-0 border-t border-border/30 flex flex-col max-h-[45%]">
          <div className="flex items-center gap-2 px-4 py-2 bg-black/30 border-b border-border/20 shrink-0">
            <Newspaper className="w-3.5 h-3.5 text-accent" />
            <span className="text-[10px] font-black uppercase tracking-widest text-neutral">
              Related News
            </span>
            <span className="text-[9px] font-mono text-neutral/50 ml-auto">{recs.length}</span>
          </div>
          <div className="overflow-y-auto no-scrollbar flex-1">
            {recs.map((rec) => (
              <button
                key={rec.id}
                onClick={() => setSelectedArticleId(rec.article.id)}
                className="w-full text-left px-4 py-2.5 flex items-start gap-3 hover:bg-accent/[0.04] transition-colors border-b border-border/10 last:border-0 group"
              >
                <div className="shrink-0 mt-0.5">
                  <span
                    className="inline-block px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border"
                    style={{
                      backgroundColor: getActionColor(rec.action) + '15',
                      color: getActionColor(rec.action),
                      borderColor: getActionColor(rec.action) + '30',
                    }}
                  >
                    {rec.action}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-gray-300 leading-snug line-clamp-2 group-hover:text-white transition-colors">
                    {cleanTitle(rec.article.title)}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="w-2.5 h-2.5 text-neutral/50" />
                    <span className="text-[9px] font-mono text-neutral/50">
                      {new Date(rec.article.scrapedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </GlassCard>
  );
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
