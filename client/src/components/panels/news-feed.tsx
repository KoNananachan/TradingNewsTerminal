import { useEffect, useState } from 'react';
import { useNews } from '../../api/hooks/use-news';
import { useNewsClusters } from '../../api/hooks/use-clusters';
import { useWatchlist } from '../../api/hooks/use-watchlist';
import { useAppStore } from '../../stores/use-app-store';
import { useAuthStore } from '../../stores/use-auth-store';
import { useHyperliquidAssets } from '../../hooks/use-hyperliquid';
import { GlassCard } from '../common/glass-card';
import { CategorySidebar } from './category-sidebar';
import { cleanTitle } from '../../utils/clean-title';
import { useT } from '../../i18n';
import { Actions } from 'flexlayout-react';
import { getModel, PANEL_IDS } from '../layout/dock-layout';
import { MapPin, Zap, Layers, Lock, Search, X } from 'lucide-react';

export function NewsFeed() {
  const selectedCategory = useAppStore((s) => s.selectedCategory);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSelectedArticleId = useAppStore((s) => s.setSelectedArticleId);
  const setArticleCount = useAppStore((s) => s.setArticleCount);
  const setTradingCoin = useAppStore((s) => s.setTradingCoin);
  const forYouEnabled = useAppStore((s) => s.forYouEnabled);
  const setForYouEnabled = useAppStore((s) => s.setForYouEnabled);
  const categoryClicks = useAppStore((s) => s.categoryClicks);
  const trackCategoryClick = useAppStore((s) => s.trackCategoryClick);
  const tabSymbols = useAppStore((s) => s.tabSymbols);
  const { data: serverWatchlist } = useWatchlist();
  const hlAssets = useHyperliquidAssets();
  const user = useAuthStore((s) => s.user);
  const isPro = useAuthStore((s) => s.isPro);
  const setLoginModalOpen = useAuthStore((s) => s.setLoginModalOpen);
  const setUpgradeModalOpen = useAuthStore((s) => s.setUpgradeModalOpen);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const t = useT();
  const [viewMode, setViewMode] = useState<'articles' | 'clusters'>('articles');
  const [localSearch, setLocalSearch] = useState(searchQuery);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(localSearch), 300);
    return () => clearTimeout(timer);
  }, [localSearch, setSearchQuery]);
  const { data: clustersData } = useNewsClusters(20, 3);

  // Collect all watchlist symbols for personalized scoring (both localStorage tabs + server)
  const watchlistSymbols = new Set([
    ...Object.values(tabSymbols).flat(),
    ...(serverWatchlist?.map(w => w.symbol) || []),
  ]);

  // Personalized scoring function (F13)
  const scoreArticle = (article: any): number => {
    let score = 0;
    // Watchlist ticker match (×10)
    const tickers = article.recommendations?.map((r: any) => r.symbol) || [];
    for (const t of tickers) {
      if (watchlistSymbols.has(t)) score += 10;
    }
    // Category preference (×2)
    if (article.category?.slug && categoryClicks[article.category.slug]) {
      score += Math.min(categoryClicks[article.category.slug], 5) * 2;
    }
    // Freshness (×5) - newer = higher
    const ageHours = (Date.now() - new Date(article.scrapedAt).getTime()) / 3600000;
    score += Math.max(0, 5 - ageHours / 2);
    // Sentiment intensity (×3)
    if (article.sentimentScore != null) {
      score += Math.abs(article.sentimentScore) * 3;
    }
    return score;
  };

  // Track category clicks for personalization
  const handleArticleClick = (article: any) => {
    setSelectedArticleId(article.id);
    if (article.category?.slug) {
      trackCategoryClick(article.category.slug);
    }
  };

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
          <div className="flex text-[9px] font-bold font-mono uppercase tracking-tighter">
            <button
              onClick={() => setForYouEnabled(false)}
              className={`px-2 py-0.5 border transition-colors ${!forYouEnabled ? 'bg-accent text-black border-accent' : 'bg-black text-neutral border-border hover:text-white'}`}
            >
              {t('allNews')}
            </button>
            <button
              onClick={() => setForYouEnabled(true)}
              className={`px-2 py-0.5 border-t border-b border-r transition-colors ${forYouEnabled ? 'bg-accent text-black border-accent' : 'bg-black text-neutral border-border hover:text-white'}`}
            >
              {t('forYou')}
            </button>
          </div>
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

      {/* Search Bar */}
      <div className="flex items-center gap-2 px-2 py-1 border-b border-border bg-black/60">
        <Search className="w-3 h-3 text-neutral/50 shrink-0" />
        <input
          type="text"
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder={t('searchNews')}
          className="flex-1 bg-transparent text-[10px] font-mono text-white placeholder:text-neutral/40 outline-none"
        />
        {localSearch && (
          <button onClick={() => { setLocalSearch(''); setSearchQuery(''); }} className="text-neutral hover:text-accent">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* View Mode Toggle: ARTICLES | CLUSTERS */}
      <div className="flex border-b border-border bg-black">
        <button
          onClick={() => setViewMode('articles')}
          className={`flex-1 py-1 text-[9px] font-bold font-mono uppercase tracking-widest transition-colors ${viewMode === 'articles' ? 'text-accent border-b border-accent' : 'text-neutral hover:text-white'}`}
        >
          {t('articles')}
        </button>
        <button
          onClick={() => setViewMode('clusters')}
          className={`flex-1 py-1 text-[9px] font-bold font-mono uppercase tracking-widest transition-colors flex items-center justify-center gap-1 ${viewMode === 'clusters' ? 'text-accent border-b border-accent' : 'text-neutral hover:text-white'}`}
        >
          <Layers className="w-3 h-3" /> {t('clusters')}
        </button>
      </div>

      {viewMode === 'articles' && (
      <>
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

        {!isLoading && data?.articles?.length === 0 && (
          <div className="flex items-center justify-center h-32">
            <span className="text-[10px] font-mono text-neutral uppercase">{t('noResults')}</span>
          </div>
        )}

        <div className="flex flex-col">
          {(forYouEnabled
              ? [...(data?.articles || [])].sort((a, b) => scoreArticle(b) - scoreArticle(a))
              : data?.articles || []
            ).map((article, index) => {
              const sentimentColor = getSentimentColor(article.sentiment);
              return (
                <button
                  key={article.id}
                  onClick={() => handleArticleClick(article)}
                  className="w-full text-left grid grid-cols-[60px_1fr_90px] gap-2 px-2 py-1.5 border-b border-border/50 hover:bg-white/5 transition-colors cursor-pointer group relative"
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
                    
                    <h3 className="text-[12px] font-bold text-neutral group-hover:text-accent leading-snug transition-colors line-clamp-2 uppercase">
                      {cleanTitle(article.title)}
                    </h3>
                  </div>
                  
                  {/* Signal Column */}
                  <div className="flex flex-col items-end gap-1 shrink-0 border-l border-border/30 pl-2">
                    {article.recommendations.length > 0 ? (
                      <>
                        {/* First ticker always visible */}
                        {article.recommendations.slice(0, 1).map((rec) => {
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
                        })}
                        {/* Additional tickers: blurred for non-Pro */}
                        {article.recommendations.length > 1 && (
                          isPro() ? (
                            article.recommendations.slice(1, 2).map((rec) => {
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
                            <div
                              onClick={(e) => { e.stopPropagation(); user ? setUpgradeModalOpen(true) : setLoginModalOpen(true); }}
                              className="flex items-center gap-1 font-mono text-[9px] font-bold text-neutral/30 cursor-pointer hover:text-accent/50"
                              title="Upgrade to Pro"
                            >
                              <Lock className="w-2.5 h-2.5" />
                              <span className="blur-[3px] select-none">XXXX</span>
                            </div>
                          )
                        )}
                      </>
                    ) : (
                      <span className="text-[8px] font-mono text-neutral/20 uppercase tracking-tighter">---</span>
                    )}
                  </div>

                  {/* Selection Indicator */}
                  <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-accent opacity-0 group-hover:opacity-100" />
                </button>
              );
            })}
        </div>
      </div>
      </>
      )}

      {/* Clusters View */}
      {viewMode === 'clusters' && (
        <div className="flex-1 overflow-auto no-scrollbar bg-black">
          {!clustersData || clustersData.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <span className="text-[10px] font-mono text-neutral animate-pulse uppercase">{t('loading')}</span>
            </div>
          ) : (
            <div className="flex flex-col">
              {clustersData.map((cluster) => (
                <div key={cluster.id} className="px-3 py-2 border-b border-border/50 hover:bg-white/5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 bg-accent/20 text-accent border border-accent/30">
                      {cluster.impactScore.toFixed(1)}
                    </span>
                    <span className="text-[9px] font-mono text-neutral">
                      {cluster.articleCount} {t('articles').toLowerCase()}
                    </span>
                    {cluster.category && (
                      <span className="text-[9px] font-bold uppercase tracking-tighter text-accent">
                        [{cluster.category}]
                      </span>
                    )}
                  </div>
                  <h3 className="text-[11px] font-bold text-white uppercase leading-snug line-clamp-2">
                    {cluster.title}
                  </h3>
                  {cluster.tickers.length > 0 && (
                    <div className="flex gap-1.5 mt-1 flex-wrap">
                      {cluster.tickers.slice(0, 8).map(ticker => (
                        <span key={ticker} className="text-[9px] font-mono font-bold text-accent">{ticker}</span>
                      ))}
                      {cluster.tickers.length > 8 && (
                        <span className="text-[8px] font-mono text-neutral">+{cluster.tickers.length - 8}</span>
                      )}
                    </div>
                  )}
                  {cluster.avgSentiment != null && (
                    <div className="mt-1 flex items-center gap-1">
                      <div className="w-1.5 h-1.5" style={{ backgroundColor: cluster.avgSentiment > 0 ? '#22c55e' : cluster.avgSentiment < 0 ? '#ef4444' : '#a1a1aa' }} />
                      <span className="text-[8px] font-mono text-neutral">
                        {cluster.avgSentiment > 0 ? '+' : ''}{cluster.avgSentiment.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
