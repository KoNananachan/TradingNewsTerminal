import { useEffect } from 'react';
import { useAppStore } from '../stores/use-app-store';

export function useKeyboard() {
  const setShortcutsModalOpen = useAppStore((s) => s.setShortcutsModalOpen);
  const setStockPanelView = useAppStore((s) => s.setStockPanelView);
  const shortcutsModalOpen = useAppStore((s) => s.shortcutsModalOpen);
  const commandPaletteOpen = useAppStore((s) => s.commandPaletteOpen);
  const compareSymbols = useAppStore((s) => s.compareSymbols);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (isInput || commandPaletteOpen) return;

      const key = e.key;

      // Escape: close modal
      if (key === 'Escape') {
        e.preventDefault();
        if (shortcutsModalOpen) {
          setShortcutsModalOpen(false);
        }
        return;
      }

      // ? toggle shortcuts help
      if (key === '?') {
        e.preventDefault();
        setShortcutsModalOpen(!shortcutsModalOpen);
        return;
      }

      // h: heatmap view
      if (key === 'h') {
        e.preventDefault();
        setStockPanelView('heatmap');
        return;
      }

      // c: compare view
      if (key === 'c' && compareSymbols.length > 0) {
        e.preventDefault();
        setStockPanelView('compare');
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    commandPaletteOpen, shortcutsModalOpen, compareSymbols,
    setShortcutsModalOpen, setStockPanelView,
  ]);
}
