import { useEffect, type RefObject } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../stores/use-app-store';
import { ALL_PANEL_IDS, getLocalizedPanelName, showPanelInLayout, hidePanelInLayout, resetLayout } from '../layout/dock-layout';
import { Eye, EyeOff, RotateCcw } from 'lucide-react';

interface PanelToggleMenuProps {
  open: boolean;
  onClose: () => void;
  containerRef: RefObject<HTMLDivElement | null>;
}

export function PanelToggleMenu({ open, onClose, containerRef }: PanelToggleMenuProps) {
  const hiddenPanels = useAppStore((s) => s.hiddenPanels);
  const hidePanel = useAppStore((s) => s.hidePanel);
  const showPanel = useAppStore((s) => s.showPanel);
  useAppStore((s) => s.locale); // subscribe to locale changes for i18n panel names

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose, containerRef]);

  const togglePanel = (panelId: string) => {
    const isHidden = hiddenPanels.includes(panelId);
    if (isHidden) {
      showPanel(panelId);
      showPanelInLayout(panelId);
    } else {
      hidePanel(panelId);
      hidePanelInLayout(panelId);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.1 }}
          className="absolute right-0 top-full mt-1 w-52 bg-zinc-900 border border-border/80 shadow-2xl z-50"
        >
          <div className="px-3 py-2 border-b border-border/30">
            <span className="text-[9px] font-black uppercase tracking-[0.15em] text-accent">
              Panels
            </span>
          </div>
          <div className="py-1">
            {ALL_PANEL_IDS.map((panelId) => {
              const isHidden = hiddenPanels.includes(panelId);
              return (
                <button
                  key={panelId}
                  onClick={() => togglePanel(panelId)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-white/5 transition-colors ${
                    isHidden ? 'opacity-40' : ''
                  }`}
                >
                  {isHidden ? (
                    <EyeOff className="w-3.5 h-3.5 text-neutral/50 shrink-0" />
                  ) : (
                    <Eye className="w-3.5 h-3.5 text-accent shrink-0" />
                  )}
                  <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                    isHidden ? 'text-neutral/50' : 'text-white'
                  }`}>
                    {getLocalizedPanelName(panelId)}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="border-t border-border/30 px-3 py-2">
            <button
              onClick={resetLayout}
              className="w-full flex items-center gap-2.5 px-0 py-1.5 text-left text-neutral/60 hover:text-bearish transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" />
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider">
                Reset Default Layout
              </span>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
