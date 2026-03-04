import { useRecommendations } from '../../api/hooks/use-recommendations';
import { useAppStore } from '../../stores/use-app-store';
import { GlassCard } from '../common/glass-card';

const ACTION_COLORS: Record<string, string> = {
  BUY: '#10b981',
  SELL: '#ef4444',
  HOLD: '#3b82f6',
  WATCH: '#f97316',
};

export function AiInsights() {
  const { data: recommendations } = useRecommendations(15);
  const setSelectedArticleId = useAppStore((s) => s.setSelectedArticleId);

  return (
    <GlassCard
      className="h-full"
    >
      <div className="flex-1 overflow-auto no-scrollbar bg-black flex flex-col">
        <div className="p-1 space-y-1">
          {recommendations?.map((rec, index) => {
              const color = ACTION_COLORS[rec.action] ?? '#cccccc';
              return (
                <div
                  key={rec.id}
                  className="p-2 border border-border bg-[#050505] hover:border-ai transition-colors group relative"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-bold text-white bg-border px-1">
                        {rec.symbol}
                      </span>
                      <span
                        className="text-[10px] font-mono font-bold px-1 border uppercase"
                        style={{ 
                          color,
                          borderColor: color
                        }}
                      >
                        {rec.action}
                      </span>
                    </div>
                  </div>

                  {/* Reason snippet */}
                  {rec.reason && (
                    <p className="text-[10px] text-neutral leading-tight mb-1 font-mono uppercase">
                      &gt; {rec.reason}
                    </p>
                  )}

                  {/* Linked article */}
                  {rec.article && (
                    <button
                      onClick={() => setSelectedArticleId(rec.article.id)}
                      className="flex items-center gap-1 text-[9px] font-bold text-accent hover:underline transition-colors w-full text-left uppercase truncate"
                    >
                      SOURCE: {rec.article.title}
                    </button>
                  )}
                </div>
              );
            })}
        </div>
        
        {(!recommendations || recommendations.length === 0) && (
          <div className="flex flex-col items-center justify-center p-8 text-neutral h-32">
            <span className="text-[10px] font-mono animate-pulse uppercase">AWAITING NEURAL SYNTHESIS...</span>
          </div>
        )}

        <div className="mt-auto px-2 py-2 border-t border-border bg-[#0a0a0a]">
          <p className="text-[9px] font-mono text-neutral leading-tight uppercase">
            <span className="text-bearish font-bold">WARNING:</span> AI ANALYSIS MAY BE INACCURATE. NOT FINANCIAL ADVICE. <span className="text-white font-bold">DYOR</span>.
          </p>
        </div>
      </div>
    </GlassCard>
  );
}
