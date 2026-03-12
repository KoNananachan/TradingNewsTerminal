import { useState, useMemo } from 'react';
import { GlassCard } from '../common/glass-card';
import { useMissedOpportunities, type MissedOpportunity } from '../../api/hooks/use-missed-opportunities';
import { getLocalizedTitle, getLocalizedReason } from '../../api/hooks/use-news';
import { useAppStore } from '../../stores/use-app-store';
import { TrendingUp, AlertTriangle } from 'lucide-react';
import { useT } from '../../i18n';

type SortField = 'bestReturn' | 'return1d' | 'return3d' | 'return5d';

function formatReturn(r: number | null): string {
  if (r == null) return '--';
  return (r >= 0 ? '+' : '') + r.toFixed(2) + '%';
}

function returnColor(r: number | null): string {
  if (r == null) return 'text-neutral/40';
  if (r > 5) return 'text-bullish';
  if (r > 0) return 'text-bullish/70';
  if (r < -5) return 'text-bearish';
  if (r < 0) return 'text-bearish/70';
  return 'text-neutral/60';
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function MissedOpportunitiesContent() {
  const t = useT();
  const { data: opportunities, isLoading, error } = useMissedOpportunities();
  const [sortBy, setSortBy] = useState<SortField>('bestReturn');
  const setSelectedArticleId = useAppStore((s) => s.setSelectedArticleId);

  const sorted = useMemo(() => {
    if (!opportunities) return [];
    const result = [...opportunities];
    result.sort((a, b) => {
      const av = a[sortBy] ?? -Infinity;
      const bv = b[sortBy] ?? -Infinity;
      return bv - av;
    });
    return result;
  }, [opportunities, sortBy]);

  const sortButtons: { field: SortField; label: string }[] = [
    { field: 'bestReturn', label: t('missedBest') },
    { field: 'return1d', label: '1D' },
    { field: 'return3d', label: '3D' },
    { field: 'return5d', label: '5D' },
  ];

  return (
    <GlassCard
      className="h-full"
      title={
        <span className="flex items-center gap-1.5">
          <TrendingUp size={12} className="text-accent" />
          {t('missedOpportunities')}
        </span>
      }
    >
      {/* Sort controls */}
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border bg-black/50 shrink-0">
        <div className="flex gap-0.5">
          {sortButtons.map(s => (
            <button
              key={s.field}
              onClick={() => setSortBy(s.field)}
              className={`px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider border transition-colors ${
                sortBy === s.field
                  ? 'bg-accent/20 border-accent text-accent'
                  : 'border-border text-neutral/50 hover:text-primary hover:border-accent/50'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <span className="text-[9px] font-mono text-neutral/30 ml-auto uppercase">
          {sorted.length} {t('missedResults')}
        </span>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[60px_1fr_52px_52px_52px_52px] gap-1 px-2 py-1 text-[8px] font-mono text-neutral/40 uppercase tracking-widest border-b border-border/50 shrink-0">
        <span>{t('symbol')}</span>
        <span>{t('missedSignal')}</span>
        <span className="text-right">1D</span>
        <span className="text-right">3D</span>
        <span className="text-right">5D</span>
        <span className="text-right">{t('missedBest')}</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-4 h-4 border-2 border-accent/30 border-t-accent animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <AlertTriangle size={16} className="text-bearish/50" />
            <span className="text-[10px] font-mono text-neutral/40 uppercase">{t('missedError')}</span>
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <TrendingUp size={16} className="text-neutral/20" />
            <span className="text-[10px] font-mono text-neutral/40 uppercase">{t('missedEmpty')}</span>
          </div>
        ) : (
          sorted.map((opp, i) => (
            <OpportunityRow key={`${opp.articleId}-${opp.symbol}-${i}`} opp={opp} rank={i + 1} onClickArticle={setSelectedArticleId} />
          ))
        )}
      </div>
    </GlassCard>
  );
}

function OpportunityRow({ opp, rank, onClickArticle }: { opp: MissedOpportunity; rank: number; onClickArticle: (id: number) => void }) {
  const localTitle = getLocalizedTitle({ title: opp.articleTitle, titleTranslations: opp.titleTranslations });
  const localReason = getLocalizedReason({ reason: opp.reason, reasonTranslations: opp.reasonTranslations });

  return (
    <div
      className="grid grid-cols-[60px_1fr_52px_52px_52px_52px] gap-1 px-2 py-1.5 border-b border-border/30 hover:bg-white/[0.02] transition-colors group cursor-pointer"
      onClick={() => opp.articleId && onClickArticle(opp.articleId)}
    >
      {/* Symbol */}
      <div className="flex flex-col gap-0.5">
        <span className="text-[11px] font-bold font-mono text-primary truncate">{opp.symbol}</span>
        <div className="flex items-center gap-1">
          <TrendingUp size={8} className="text-bullish" />
          <span className="text-[8px] font-mono font-bold text-bullish">BUY</span>
        </div>
      </div>

      {/* News title + reason */}
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[10px] font-mono text-neutral/80 truncate group-hover:text-primary transition-colors">
          {localTitle}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[8px] font-mono text-neutral/30 shrink-0">
            {formatDate(opp.publishedAt)}
          </span>
          <span className="text-[8px] font-mono text-neutral/30">
            ${opp.priceAtNews.toFixed(2)}
          </span>
          {localReason && (
            <span className="text-[8px] font-mono text-neutral/40 truncate">
              {localReason}
            </span>
          )}
        </div>
      </div>

      {/* Returns */}
      <span className={`text-[10px] font-mono text-right self-center ${returnColor(opp.return1d)}`}>
        {formatReturn(opp.return1d)}
      </span>
      <span className={`text-[10px] font-mono text-right self-center ${returnColor(opp.return3d)}`}>
        {formatReturn(opp.return3d)}
      </span>
      <span className={`text-[10px] font-mono text-right self-center ${returnColor(opp.return5d)}`}>
        {formatReturn(opp.return5d)}
      </span>
      <span className={`text-[10px] font-mono font-bold text-right self-center ${returnColor(opp.bestReturn)}`}>
        {formatReturn(opp.bestReturn)}
      </span>
    </div>
  );
}

export function MissedOpportunitiesPanel() {
  return <MissedOpportunitiesContent />;
}
