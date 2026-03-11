import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../stores/use-app-store';
import { Terminal, Search, Globe, TrendingUp, Cpu, X, Command } from 'lucide-react';
import { useCategories } from '../../api/hooks/use-categories';
import { useT } from '../../i18n';

export function CommandPalette() {
  const isOpen = useAppStore((s) => s.commandPaletteOpen);
  const setOpen = useAppStore((s) => s.setCommandPaletteOpen);
  const setSelectedSymbol = useAppStore((s) => s.setSelectedSymbol);
  const setSelectedCategory = useAppStore((s) => s.setSelectedCategory);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  
  const t = useT();
  const [input, setInput] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const { data: categories } = useCategories();
  const inputRef = useRef<HTMLInputElement>(null);

  // Command handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'k') {
        e.preventDefault();
        setOpen(!isOpen);
      }
      if (e.key === 'Escape' && isOpen) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, setOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 10);
      setInput('');
      setActiveIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!input) {
      setResults([
        { type: 'command', id: 'news', label: t('cmdNews'), icon: <Terminal className="w-4 h-4" />, action: () => setSelectedCategory(null) },
        { type: 'command', id: 'ai', label: t('cmdAi'), icon: <Cpu className="w-4 h-4" />, action: () => {} },
        { type: 'command', id: 'map', label: t('cmdMap'), icon: <Globe className="w-4 h-4" />, action: () => {} },
      ]);
      return;
    }

    const searchResults: any[] = [];
    
    // Ticker detection (starts with dot or uppercase)
    if (input.startsWith('.') || (input.length <= 5 && /^[A-Z]+$/.test(input))) {
      const symbol = input.startsWith('.') ? input.slice(1).toUpperCase() : input.toUpperCase();
      searchResults.push({
        type: 'ticker',
        id: `ticker-${symbol}`,
        label: `GO ${symbol} - View Market Data`,
        icon: <TrendingUp className="w-4 h-4 text-bullish" />,
        action: () => setSelectedSymbol(symbol)
      });
    }

    // Categories
    categories?.forEach(cat => {
      if (cat.name.toLowerCase().includes(input.toLowerCase())) {
        searchResults.push({
          type: 'category',
          id: `cat-${cat.slug}`,
          label: `CAT ${cat.name}`,
          icon: <Search className="w-4 h-4" />,
          action: () => setSelectedCategory(cat.slug)
        });
      }
    });

    // General search
    searchResults.push({
      type: 'search',
      id: 'global-search',
      label: `SEARCH "${input}"`,
      icon: <Search className="w-4 h-4" />,
      action: () => setSearchQuery(input)
    });

    setResults(searchResults);
    setActiveIndex(0);
  }, [input, categories, setSelectedSymbol, setSelectedCategory, setSearchQuery]);

  const handleExecute = (item: any) => {
    item.action();
    setOpen(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
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
          className="w-full max-w-xl bg-panel border border-accent/30 rounded-xl shadow-2xl overflow-hidden z-10"
        >
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-bg/50">
            <Command className="w-5 h-5 text-accent animate-pulse" />
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('cmdPlaceholder')}
              className="flex-1 bg-transparent border-none outline-none text-gray-100 font-mono text-sm placeholder:text-neutral"
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActiveIndex(prev => (prev + 1) % results.length);
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActiveIndex(prev => (prev - 1 + results.length) % results.length);
                } else if (e.key === 'Enter') {
                  handleExecute(results[activeIndex]);
                }
              }}
            />
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-panel border border-border/50 text-[10px] font-bold text-neutral">
              ESC
            </div>
          </div>

          <div className="max-h-[350px] overflow-y-auto p-2 no-scrollbar">
            {results.length > 0 ? (
              results.map((item, index) => (
                <button
                  key={item.id}
                  onClick={() => handleExecute(item)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    index === activeIndex ? 'bg-accent/20 border border-accent/30 text-white translate-x-1' : 'text-neutral hover:text-gray-200'
                  }`}
                >
                  <span className={index === activeIndex ? 'text-accent' : ''}>{item.icon}</span>
                  <span className="flex-1 text-left font-mono">{item.label}</span>
                  {index === activeIndex && (
                    <span className="text-[10px] font-bold text-accent/60 flex items-center gap-1 uppercase tracking-tighter">
                      {t('execute')} <Terminal className="w-3 h-3" />
                    </span>
                  )}
                </button>
              ))
            ) : (
              <div className="py-8 text-center text-neutral text-xs italic">
                {t('cmdNoResults')}
              </div>
            )}
          </div>
          
          <div className="px-4 py-2 border-t border-border/30 bg-bg/30 flex justify-between items-center">
            <div className="flex gap-4">
              <span className="text-[10px] text-neutral flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-panel border border-border/50">↑↓</kbd> {t('navigate')}
              </span>
              <span className="text-[10px] text-neutral flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-panel border border-border/50">Enter</kbd> {t('execute')}
              </span>
            </div>
            <span className="text-[10px] font-bold text-accent/50 uppercase tracking-widest">
              Terminal v2.6
            </span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
