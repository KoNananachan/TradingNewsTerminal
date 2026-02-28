import { useMemo } from 'react';
import { useNewsById } from '../../api/hooks/use-news';
import { useStockNames } from '../../api/hooks/use-stocks';
import { useHyperliquidAssets } from '../../hooks/use-hyperliquid';
import { cleanTitle } from '../../utils/clean-title';
import { useAppStore } from '../../stores/use-app-store';
import { SentimentBadge } from '../common/sentiment-badge';
import { Badge } from '../common/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, BarChart2, Globe, Clock, ChevronLeft, Zap } from 'lucide-react';
import { Actions } from 'flexlayout-react';
import { getModel, PANEL_IDS } from '../layout/dock-layout';

export function NewsDetail() {
  const selectedArticleId = useAppStore((s) => s.selectedArticleId);
  const setSelectedArticleId = useAppStore((s) => s.setSelectedArticleId);
  const setTradingCoin = useAppStore((s) => s.setTradingCoin);
  const { data: article, isLoading } = useNewsById(selectedArticleId);

  const recSymbols = useMemo(
    () => article?.recommendations.map(r => r.symbol) ?? [],
    [article],
  );
  const { data: stockNames } = useStockNames(recSymbols);
  const hlAssets = useHyperliquidAssets();

  const handleTrade = (symbol: string) => {
    setTradingCoin(symbol);
    setSelectedArticleId(null); // close drawer so trading panel is visible
    // Activate the trading tab in flexlayout
    const model = getModel();
    if (model) {
      try {
        model.doAction(Actions.selectTab(PANEL_IDS.TRADING));
      } catch { /* tab might not exist */ }
    }
  };

  return (
    <AnimatePresence>
      {selectedArticleId && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedArticleId(null)}
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
          />
          
          {/* Side Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="w-full max-w-xl bg-bg border-l border-border/50 shadow-[-20px_0_50px_rgba(0,0,0,0.5)] flex flex-col relative z-10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Bar */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-border/30 bg-black/40">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedArticleId(null)}
                  className="p-1 -ml-1 text-neutral hover:text-white rounded hover:bg-white/5 transition-all"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="h-4 w-px bg-border/50" />
                <div className="flex items-center gap-2 text-accent">
                  <BarChart2 className="w-4 h-4" />
                  <span className="text-[10px] font-black tracking-[0.2em] uppercase">
                    Event Intelligence
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedArticleId(null)}
                className="text-neutral hover:text-white p-1 rounded-full hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-1 bg-border/30 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ x: '-100%' }}
                    animate={{ x: '100%' }}
                    transition={{ repeat: Infinity, duration: 1 }}
                    className="w-full h-full bg-accent"
                  />
                </div>
                <span className="text-[10px] font-mono text-neutral uppercase tracking-widest">Accessing Node...</span>
              </div>
            ) : article ? (
              <div className="flex-1 overflow-auto no-scrollbar flex flex-col">
                <div className="p-8">
                  {/* Category & Time */}
                  <div className="flex items-center gap-4 mb-6">
                    {article.category && (
                      <Badge color={article.category.color ?? '#a1a1aa'}>
                        {article.category.name}
                      </Badge>
                    )}
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-neutral uppercase">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(article.scrapedAt).toLocaleString()}
                    </div>
                  </div>

                  {/* Image Support */}
                  {article.imageUrl && (
                    <div className="mb-8 rounded-xl overflow-hidden border border-border/30 shadow-2xl">
                      <img 
                        src={article.imageUrl} 
                        alt={article.title} 
                        className="w-full h-auto object-cover max-h-[320px] hover:scale-105 transition-transform duration-700"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                    </div>
                  )}

                  {/* Title */}
                  <h2 className="text-3xl font-black text-white leading-[1.1] mb-8 tracking-tighter drop-shadow-sm">
                    {cleanTitle(article.title)}
                  </h2>

                  {/* Meta Grid */}
                  <div className="grid grid-cols-2 gap-px bg-border/20 border border-border/20 rounded-lg overflow-hidden mb-10 shadow-inner">
                    <div className="p-4 bg-black/30 flex flex-col gap-2">
                      <span className="text-[10px] font-black text-neutral uppercase tracking-[0.2em]">Intelligence Sentiment</span>
                      <SentimentBadge sentiment={article.sentiment} />
                    </div>
                    <div className="p-4 bg-black/30 flex flex-col gap-2">
                      <span className="text-[10px] font-black text-neutral uppercase tracking-[0.2em]">Geospatial Node</span>
                      <div className="flex items-center gap-2 text-white text-xs font-bold uppercase font-mono">
                        <Globe className="w-4 h-4 text-accent" />
                        {article.locationName || 'International / Global'}
                      </div>
                    </div>
                  </div>

                  {/* Asset Signals with Analysis */}
                  {article.recommendations.length > 0 && (
                    <div className="mb-10">
                      <div className="flex items-center gap-3 text-[11px] font-black text-neutral uppercase tracking-[0.3em] mb-6">
                        <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-border/50" />
                        Impact Analysis
                        <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-border/50" />
                      </div>
                      <div className="grid gap-3 mb-6">
                        {article.recommendations.map((rec) => {
                          const isTradeable = hlAssets.has(rec.symbol);
                          const fullName = stockNames?.[rec.symbol];
                          return (
                          <div
                            key={rec.id}
                            className="p-4 bg-white/[0.02] hover:bg-white/[0.04] rounded-xl border border-border/30 hover:border-accent/30 transition-all group shadow-sm"
                          >
                            <div className="flex items-center justify-between mb-2.5">
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="font-mono text-sm font-black text-white bg-black/40 px-2.5 py-1 rounded border border-border/50 group-hover:border-accent/40 transition-colors shrink-0">
                                  {rec.symbol}
                                </span>
                                {fullName && (
                                  <span className="text-[11px] text-neutral truncate" title={fullName}>
                                    {fullName}
                                  </span>
                                )}
                                <span
                                  className="text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-[0.1em] border shrink-0"
                                  style={{
                                    backgroundColor: getActionColor(rec.action) + '15',
                                    color: getActionColor(rec.action),
                                    borderColor: getActionColor(rec.action) + '40',
                                  }}
                                >
                                  {rec.action}
                                </span>
                              </div>
                              <button
                                onClick={() => isTradeable && handleTrade(rec.symbol)}
                                disabled={!isTradeable}
                                title={isTradeable ? `Trade ${rec.symbol} on Hyperliquid` : 'Not available on Hyperliquid'}
                                className={`shrink-0 ml-3 flex items-center gap-1 px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-[0.1em] border transition-all ${
                                  isTradeable
                                    ? 'bg-bullish/10 text-bullish border-bullish/40 hover:bg-bullish/20 hover:border-bullish/60 cursor-pointer'
                                    : 'bg-white/[0.03] text-neutral/40 border-border/20 cursor-not-allowed'
                                }`}
                              >
                                <Zap className="w-3 h-3" />
                                TRADE
                              </button>
                            </div>
                            {rec.reason && (
                              <p className="text-[12px] text-gray-400 leading-relaxed group-hover:text-gray-300 transition-colors">
                                {rec.reason}
                              </p>
                            )}
                          </div>
                          );
                        })}
                      </div>
                      <div className="px-4 py-2 border border-bearish/30 bg-bearish/5 rounded">
                        <p className="text-[10px] font-mono text-neutral leading-normal uppercase">
                          <span className="text-bearish font-bold">Caution:</span> This analysis is synthesized by AI and may be factually incorrect. Not financial advice. <span className="text-white font-bold">DYOR</span>.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Footer Action */}
                  <div className="flex pt-6 border-t border-border/30">
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 text-[11px] font-black text-white bg-accent hover:bg-accent-glow transition-all py-4 rounded-md uppercase tracking-[0.2em]"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View Source Terminal
                    </a>
                  </div>
                </div>
              </div>
            ) : null}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
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
