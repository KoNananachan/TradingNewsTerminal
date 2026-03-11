import { useRecommendations } from '../../api/hooks/use-recommendations';
import { useAppStore } from '../../stores/use-app-store';
import { GlassCard } from '../common/glass-card';
import { Brain, RefreshCw } from 'lucide-react';
import { useT } from '../../i18n';
import { getLocalizedTitle, getLocalizedReason } from '../../api/hooks/use-news';

const ACTION_COLORS: Record<string, string> = {
  BUY: '#10b981',
  SELL: '#ef4444',
  HOLD: '#3b82f6',
  WATCH: '#f97316',
};

const ACTION_ICONS: Record<string, string> = {
  BUY: '▲',
  SELL: '▼',
  HOLD: '■',
  WATCH: '◆',
};

function SkeletonCard() {
  return (
    <div className="p-2 border border-border/30 bg-[#050505]">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="skeleton h-4 w-12" />
        <div className="skeleton h-4 w-10" />
      </div>
      <div className="skeleton h-3 w-full mb-1" />
      <div className="skeleton h-3 w-3/4" />
    </div>
  );
}

export function AiInsights() {
  const t = useT();
  const { data: recommendations, isLoading, error, refetch } = useRecommendations(15);
  const setSelectedArticleId = useAppStore((s) => s.setSelectedArticleId);

  return (
    <GlassCard
      className="h-full"
      headerRight={
        <button
          onClick={() => refetch()}
          className="p-0.5 text-neutral/50 hover:text-accent transition-colors"
          title={t('refresh')}
          aria-label="Refresh AI insights"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      }
    >
      <div className="flex-1 overflow-auto no-scrollbar bg-black flex flex-col">
        {/* Loading skeleton */}
        {isLoading && !recommendations && (
          <div className="p-1 space-y-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* Error state */}
        {error && !recommendations && (
          <div className="flex flex-col items-center justify-center p-8 text-neutral h-32 gap-2">
            <span className="text-[10px] font-mono text-bearish/60 uppercase">
              {t('failedToLoadData')}
            </span>
            <button
              onClick={() => refetch()}
              className="text-[9px] font-mono text-accent hover:text-white border border-accent/30 px-2 py-0.5 transition-colors uppercase"
            >
              {t('retry')}
            </button>
          </div>
        )}

        {/* Recommendations list */}
        {recommendations && recommendations.length > 0 && (
          <div className="p-1 space-y-1">
            {recommendations.map((rec) => {
              const color = ACTION_COLORS[rec.action] ?? '#cccccc';
              const icon = ACTION_ICONS[rec.action] ?? '●';
              return (
                <div
                  key={rec.id}
                  className="p-2 border border-border bg-[#050505] hover:border-ai transition-colors group relative"
                  role="article"
                  aria-label={`${rec.action} ${rec.symbol}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-bold text-white bg-border px-1">
                        {rec.symbol}
                      </span>
                      <span
                        className="text-[10px] font-mono font-bold px-1 border uppercase flex items-center gap-0.5"
                        style={{
                          color,
                          borderColor: color,
                        }}
                      >
                        <span className="text-[8px]">{icon}</span> {rec.action}
                      </span>
                    </div>
                    {rec.confidence != null && (
                      <span
                        className="text-[8px] font-mono font-bold px-1 py-0.5 border"
                        style={{
                          color: color,
                          borderColor: `${color}40`,
                          backgroundColor: `${color}10`,
                        }}
                      >
                        {(rec.confidence * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>

                  {/* Reason snippet */}
                  {rec.reason && (
                    <p className="text-[10px] text-neutral leading-tight mb-1 font-mono uppercase line-clamp-2">
                      &gt; {getLocalizedReason(rec)}
                    </p>
                  )}

                  {/* Linked article */}
                  {rec.article && (
                    <button
                      onClick={() => setSelectedArticleId(rec.article.id)}
                      className="flex items-center gap-1 text-[9px] font-bold text-accent hover:underline transition-colors w-full text-left uppercase truncate"
                      aria-label={`View source article: ${rec.article.title}`}
                    >
                      {t('source')}: {getLocalizedTitle(rec.article)}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && (!recommendations || recommendations.length === 0) && !error && (
          <div className="flex flex-col items-center justify-center p-8 text-neutral h-32 gap-2">
            <Brain className="w-5 h-5 text-ai/30" />
            <span className="text-[10px] font-mono animate-pulse uppercase">
              {t('awaitingSynthesis')}
            </span>
          </div>
        )}

        <div className="mt-auto px-2 py-2 border-t border-border bg-[#0a0a0a]">
          <p className="text-[9px] font-mono text-neutral leading-tight uppercase">
            {t('aiWarning')}
          </p>
        </div>
      </div>
    </GlassCard>
  );
}
