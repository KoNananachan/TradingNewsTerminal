import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../stores/use-app-store';
import { X, Keyboard } from 'lucide-react';

const ALL_SHORTCUTS = [
  { keys: 'H', desc: 'Heatmap View' },
  { keys: 'C', desc: 'Compare View' },
  { keys: '?', desc: 'Shortcuts Help' },
  { keys: 'Esc', desc: 'Close Dialog' },
  { keys: 'Alt+K', desc: 'Command Palette' },
];

export function KeyboardHUD() {
  const baseKeys = [
    { keys: '?', label: 'Help' },
    { keys: 'Alt+K', label: 'Search' },
  ];

  return (
    <div className="fixed bottom-2 left-4 z-50 flex flex-col items-start gap-1 pointer-events-none">
      <div className="bg-black/70 backdrop-blur-sm border border-border/30 px-3 py-1.5 flex items-center gap-3">
        {baseKeys.map((k) => (
          <div key={k.keys} className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-white/5 text-[9px] font-mono font-bold text-accent border border-accent/20">
              {k.keys}
            </kbd>
            <span className="text-[9px] text-neutral/60 font-mono">{k.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ShortcutsModal() {
  const isOpen = useAppStore((s) => s.shortcutsModalOpen);
  const setOpen = useAppStore((s) => s.setShortcutsModalOpen);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            onClick={() => setOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="w-full max-w-md bg-panel border border-accent/30 shadow-2xl overflow-hidden z-10"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-bg/50">
              <div className="flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-accent" />
                <span className="text-sm font-bold text-white font-mono uppercase">Keyboard Shortcuts</span>
              </div>
              <button onClick={() => setOpen(false)} className="text-neutral hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-2">
              {ALL_SHORTCUTS.map((s) => (
                <div key={s.keys} className="flex items-center justify-between py-1.5 px-2 hover:bg-white/5">
                  <span className="text-sm text-gray-300 font-medium">{s.desc}</span>
                  <kbd className="px-2 py-1 bg-black/40 text-xs font-mono font-bold text-accent border border-accent/20">
                    {s.keys}
                  </kbd>
                </div>
              ))}
              <div className="pt-3 border-t border-border/30 mt-3">
                <p className="text-[10px] font-mono text-neutral/50 uppercase tracking-wider">
                  Drag tabs to rearrange panels. Drag splitters to resize.
                </p>
              </div>
            </div>
            <div className="px-4 py-2 border-t border-border/30 bg-bg/30 text-center">
              <span className="text-[10px] font-bold text-accent/50 uppercase tracking-widest">
                Press ? to toggle
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
