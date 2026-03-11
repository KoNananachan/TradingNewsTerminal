import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, TrendingUp, TrendingDown, Zap, X } from 'lucide-react';
import { useAppStore } from '../../stores/use-app-store';
import { getLocalizedTitle } from '../../api/hooks/use-news';

interface FlashArticle {
  id: number;
  title: string;
  titleTranslations?: string | null;
  sentiment: string | null;
  symbols: string[];
}

export function BreakingNewsFlash() {
  const [activeNews, setActiveNews] = useState<FlashArticle | null>(null);
  const setSelectedArticleId = useAppStore((s) => s.setSelectedArticleId);
  const breakingAlerts = useAppStore((s) => s.settings.breakingAlerts);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleBreakingNews = (e: any) => {
      if (!breakingAlerts) return;
      if (e.detail) {
        if (timerRef.current) clearTimeout(timerRef.current);
        setActiveNews(e.detail);
        timerRef.current = setTimeout(() => setActiveNews(null), 8000);
      }
    };
    window.addEventListener('breaking-news', handleBreakingNews);
    return () => {
      window.removeEventListener('breaking-news', handleBreakingNews);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [breakingAlerts]);

  return (
    <div className="fixed top-20 right-6 z-[80] w-80 pointer-events-none">
      <AnimatePresence>
        {activeNews && (
          <motion.div
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.9 }}
            className="pointer-events-auto bg-black/90 border-2 border-orange/50 rounded-xl shadow-[0_0_30px_rgba(249,115,22,0.3)] overflow-hidden"
          >
            <div className="bg-orange px-4 py-1.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-black fill-black animate-pulse" />
                <span className="text-[10px] font-black text-black uppercase tracking-[0.2em]">Breaking News</span>
              </div>
              <button onClick={() => setActiveNews(null)} className="text-black/70 hover:text-black">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-4" onClick={() => { setSelectedArticleId(activeNews.id); setActiveNews(null); }}>
              <h4 className="text-sm font-bold text-white leading-tight mb-3 cursor-pointer hover:text-orange transition-colors">
                {getLocalizedTitle(activeNews)}
              </h4>
              
              <div className="flex items-center gap-3">
                {activeNews.symbols.map(s => (
                  <span key={s} className="px-2 py-0.5 bg-white/10 rounded border border-white/20 text-[10px] font-mono font-bold text-gray-200">
                    ${s}
                  </span>
                ))}
                
                <div className={`ml-auto flex items-center gap-1 text-[10px] font-bold ${
                  activeNews.sentiment === 'BULLISH' ? 'text-bullish' : activeNews.sentiment === 'BEARISH' ? 'text-bearish' : 'text-neutral'
                }`}>
                  {activeNews.sentiment === 'BULLISH' ? <TrendingUp className="w-3.5 h-3.5" /> : activeNews.sentiment === 'BEARISH' ? <TrendingDown className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                  {activeNews.sentiment || 'NEUTRAL'}
                </div>
              </div>
            </div>
            
            <div className="h-1 bg-orange/20">
              <motion.div 
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: 8, ease: "linear" }}
                className="h-full bg-orange"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
