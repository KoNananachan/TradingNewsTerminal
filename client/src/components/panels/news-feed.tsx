import { useEffect } from 'react';
import { useNews } from '../../api/hooks/use-news';
import { useAppStore } from '../../stores/use-app-store';
import { useHyperliquidAssets } from '../../hooks/use-hyperliquid';
import { GlassCard } from '../common/glass-card';
import { Badge } from '../common/badge';
import { CategorySidebar } from './category-sidebar';
import { cleanTitle } from '../../utils/clean-title';
import { motion, AnimatePresence } from 'framer-motion';
import { useT } from '../../i18n';
import { Actions } from 'flexlayout-react';
import { getModel, PANEL_IDS } from '../layout/dock-layout';
import { Clock, MapPin, Zap, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export function NewsFeed() {
  const selectedCategory = useAppStore((s) => s.selectedCategory);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSelectedArticleId = useAppStore((s) => s.setSelectedArticleId);
  const setArticleCount = useAppStore((s) => s.setArticleCount);
  const setTradingCoin = useAppStore((s) => s.setTradingCoin);
  const hlAssets = useHyperliquidAssets();
  const t = useT();

  const handleTickerClick = (symbol: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Don't open article detail
    if (!hlAssets.has(symbol)) return;
    setTradingCoin(symbol);
    const model = getModel();
    if (model) {
      try { model.doAction(Actions.selectTab(PANEL_IDS.TRADING)); } catch {}
    }
  };

  const { data, isLoading } = useNews({
    category: selectedCategory,
    search: searchQuery || undefined,
    limit: 50,
  });

  useEffect(() => {
    if (data?.pagination.total !== undefined) {
      setArticleCount(data.pagination.total);
    }
  }, [data?.pagination.total, setArticleCount]);

  return (
    <GlassCard
      headerRight={
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-accent bg-black px-2 py-0.5 border border-accent uppercase tracking-tighter">
            <Zap className="w-3 h-3" /> {t('live')}
          </div>
        </div>
      }
      className="h-full flex flex-col"
    >
      <div className="bg-bearish/10 border-b border-bearish/30 px-3 py-1">
        <p className="text-[9px] font-mono text-bearish font-bold uppercase tracking-wider">
          {t('newsDisclaimer')}
        </p>
      </div>
      <CategorySidebar />
      
      {/* Table Header for Alignment */}
      <div className="grid grid-cols-[60px_1fr_90px] px-2 py-1 border-b border-border bg-black text-[9px] font-bold text-neutral uppercase tracking-widest">
        <span>{t('time')}</span>
        <span>{t('eventDescription')}</span>
        <span className="text-right">{t('tickers')}</span>
      </div>

      <div className="flex-1 overflow-auto no-scrollbar bg-black">
        {isLoading && (
          <div className="flex items-center justify-center h-32">
            <span className="text-[10px] font-mono text-accent animate-pulse uppercase">{t('synchronizing')}</span>
          </div>
        )}
        
        <div className="flex flex-col">
          <AnimatePresence initial={false}>
            {data?.articles.map((article, index) => {
              const sentimentColor = getSentimentColor(article.sentiment);
              return (
                <button
                  key={article.id}
                  onClick={() => setSelectedArticleId(article.id)}
                  className="w-full text-left grid grid-cols-[60px_1fr_90px] gap-2 px-2 py-1.5 border-b border-border/50 hover:bg-white/5 transition-none cursor-pointer group relative"
                >
                  {/* Time Column */}
                  <div className="flex flex-col pt-0.5 border-r border-border/30">
                    <span className="text-[10px] font-mono font-bold text-white">
                      {formatShortTime(article.scrapedAt)}
                    </span>
                    <span className="text-[8px] font-mono text-neutral/60">
                      {formatTimeAgo(article.scrapedAt)}
                    </span>
                  </div>

                  {/* Content Column */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <div 
                        className="w-2 h-2" 
                        style={{ backgroundColor: sentimentColor }} 
                      />
                      {article.category && (
                        <span className="text-[9px] font-bold uppercase tracking-tighter text-accent">
                          [{article.category.name}]
                        </span>
                      )}
                      {article.locationName && (
                        <div className="flex items-center gap-1 text-[8px] text-neutral/50 font-mono">
                          <MapPin className="w-2.5 h-2.5" />
                          <span className="truncate max-w-[80px] uppercase">{article.locationName}</span>
                        </div>
                      )}
                    </div>
                    
                    <h3 className="text-[12px] font-bold text-neutral group-hover:text-accent leading-snug transition-none line-clamp-2 uppercase">
                      {cleanTitle(article.title)}
                    </h3>
                  </div>
                  
                  {/* Signal Column */}
                  <div className="flex flex-col items-end gap-1 shrink-0 border-l border-border/30 pl-2">
                    {article.recommendations.length > 0 ? (
                      article.recommendations.slice(0, 2).map((rec) => {
                        const tradeable = hlAssets.has(rec.symbol);
                        return (
                          <div
                            key={rec.id}
                            onClick={(e) => handleTickerClick(rec.symbol, e)}
                            className={`flex items-center gap-1 font-mono text-[9px] font-bold ${tradeable ? 'cursor-pointer hover:underline' : ''}`}
                            style={{ color: getActionColor(rec.action) }}
                            title={tradeable ? `Trade ${rec.symbol}` : rec.symbol}
                          >
                            <span className={tradeable ? 'text-accent' : 'text-white'}>{rec.symbol}</span>
                            {rec.action === 'BUY' ? '▲' : rec.action === 'SELL' ? '▼' : '-'}
                          </div>
                        );
                      })
                    ) : (
                      <span className="text-[8px] font-mono text-neutral/20 uppercase tracking-tighter">---</span>
                    )}
                  </div>

                  {/* Selection Indicator */}
                  <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-accent opacity-0 group-hover:opacity-100" />
                </button>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </GlassCard>
  );
}

function formatShortTime(iso: string) {
  const d = new Date(iso);
  return d.toTimeString().slice(0, 5);
}

function formatTimeAgo(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}M`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}H`;
  return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
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

function getSentimentColor(sentiment: string | null) {
  if (sentiment === 'BULLISH') return '#22c55e';
  if (sentiment === 'BEARISH') return '#ef4444';
  return '#a1a1aa';
}
