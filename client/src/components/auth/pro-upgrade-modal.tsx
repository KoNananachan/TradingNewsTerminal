import { useState, useMemo } from 'react';
import { useAuthStore } from '../../stores/use-auth-store';
import { useAuthActions } from '../../api/hooks/use-auth';
import { useT } from '../../i18n';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, BarChart2, MessageSquare, Brain, ScanSearch, Shield, Loader2 } from 'lucide-react';

export function ProUpgradeModal() {
  const t = useT();

  const FEATURES = useMemo(() => [
    {
      icon: ScanSearch,
      title: t('featureFullTickers'),
      desc: t('featureFullTickersDesc'),
    },
    {
      icon: Brain,
      title: t('featureAnalysis'),
      desc: t('featureAnalysisDesc'),
    },
    {
      icon: MessageSquare,
      title: t('featureChat'),
      desc: t('featureChatDesc'),
    },
    {
      icon: BarChart2,
      title: t('featureInsights'),
      desc: t('featureInsightsDesc'),
    },
    {
      icon: Shield,
      title: t('featurePriority'),
      desc: t('featurePriorityDesc'),
    },
  ], [t]);
  const open = useAuthStore((s) => s.upgradeModalOpen);
  const setOpen = useAuthStore((s) => s.setUpgradeModalOpen);
  const { openCheckout } = useAuthActions();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleUpgrade = async () => {
    setLoading(true);
    setError('');
    try {
      await openCheckout();
    } catch (err: any) {
      setError(err.message || 'Failed to start checkout');
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setError('');
    setLoading(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative z-10 w-full max-w-md mx-4 border border-border/50 bg-[#080808] shadow-[0_0_80px_rgba(0,0,0,0.8)]"
          >
            {/* Close */}
            <button
              onClick={handleClose}
              className="absolute top-3 right-3 text-neutral hover:text-white p-1 z-20"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-border/30 text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 mb-3 border border-accent/40 bg-accent/10">
                <Zap className="w-3.5 h-3.5 text-accent" />
                <span className="text-[10px] font-black uppercase tracking-[0.25em] text-accent">
                  {t('proTerminal')}
                </span>
              </div>
              <h2 className="text-xl font-black text-white tracking-tight mb-1">
                {t('upgradeYourEdge')}
              </h2>
              <p className="text-[11px] font-mono text-neutral">
                {t('fullAccessDesc')}
              </p>
            </div>

            {/* Features */}
            <div className="px-6 py-5 flex flex-col gap-3.5">
              {FEATURES.map((f) => (
                <div key={f.title} className="flex gap-3 group">
                  <div className="shrink-0 w-8 h-8 flex items-center justify-center border border-border/30 bg-white/[0.02] group-hover:border-accent/40 group-hover:bg-accent/5 transition-colors">
                    <f.icon className="w-4 h-4 text-accent" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-[11px] font-bold text-white uppercase tracking-wide">
                      {f.title}
                    </h3>
                    <p className="text-[10px] font-mono text-neutral/70 leading-relaxed">
                      {f.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="px-6 pb-6 pt-2">
              {error && (
                <div className="mb-3 px-3 py-2 border border-bearish/30 bg-bearish/5">
                  <p className="text-[10px] font-mono text-bearish">{error}</p>
                </div>
              )}
              <button
                onClick={handleUpgrade}
                disabled={loading}
                className="w-full py-3.5 bg-accent hover:bg-accent/90 disabled:opacity-60 text-black text-[12px] font-black uppercase tracking-[0.2em] transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                {loading ? t('redirecting') : t('startPro')}
              </button>
              <p className="text-center text-[9px] font-mono text-neutral/40 mt-3 uppercase tracking-wider">
                {t('cancelAnytime')}
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
