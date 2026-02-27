import { useState, useRef, useEffect, useCallback } from 'react';
import { GlassCard } from '../common/glass-card';
import { Markdown } from '../common/markdown';
import { useChat, type ChatMessage } from '../../api/hooks/use-chat';
import { useTickerSearch, useWatchlist } from '../../api/hooks/use-watchlist';
import { useT } from '../../i18n';
import {
  Send,
  Square,
  X,
  Plus,
  Trash2,
  Copy,
  Check,
  ChevronDown,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

const SUGGESTED_PROMPTS_KEYS = [
  'aiChatSuggestOutlook',
  'aiChatSuggestNews',
  'aiChatSuggestRisk',
  'aiChatSuggestCompare',
] as const;

export function AiChatPanel() {
  const t = useT();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedTickers, setSelectedTickers] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [tickerQuery, setTickerQuery] = useState('');
  const [showTickerSearch, setShowTickerSearch] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);

  const { sendMessage, isStreaming, streamedText, error, clearError, abort } = useChat();
  const { data: watchlistData } = useWatchlist();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const tickerInputRef = useRef<HTMLInputElement>(null);
  const searchDropdownRef = useRef<HTMLDivElement>(null);

  const { data: tickerResults } = useTickerSearch(tickerQuery);

  // Build a quote map from watchlist data
  const quoteMap = new Map(
    (watchlistData || [])
      .filter((w) => w.quote)
      .map((w) => [w.symbol, w.quote!]),
  );

  // Auto-scroll only when user is near bottom
  useEffect(() => {
    if (isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [streamedText, messages, isNearBottom]);

  // Track scroll position
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const threshold = 80;
    setIsNearBottom(el.scrollHeight - el.scrollTop - el.clientHeight < threshold);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Close ticker search on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        searchDropdownRef.current &&
        !searchDropdownRef.current.contains(e.target as Node) &&
        !tickerInputRef.current?.contains(e.target as Node)
      ) {
        setShowTickerSearch(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  }, [inputValue]);

  const handleSend = useCallback(
    async (text?: string) => {
      const msg = (text ?? inputValue).trim();
      if (!msg || isStreaming) return;

      clearError();
      const userMsg: ChatMessage = { role: 'user', content: msg, timestamp: Date.now() };
      setMessages((prev) => [...prev, userMsg]);
      setInputValue('');

      const history = messages.map((m) => ({ role: m.role, content: m.content }));

      try {
        const fullResponse = await sendMessage(msg, selectedTickers, history);
        if (fullResponse) {
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: fullResponse, timestamp: Date.now() },
          ]);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `⚠ ${t('aiChatError')}`, timestamp: Date.now() },
        ]);
      }
    },
    [inputValue, isStreaming, messages, selectedTickers, sendMessage, clearError, t],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const addTicker = (symbol: string) => {
    const sym = symbol.toUpperCase();
    if (!selectedTickers.includes(sym)) {
      setSelectedTickers((prev) => [...prev, sym]);
    }
    setTickerQuery('');
    setShowTickerSearch(false);
  };

  const removeTicker = (symbol: string) => {
    setSelectedTickers((prev) => prev.filter((t) => t !== symbol));
  };

  const clearChat = () => {
    if (isStreaming) abort();
    setMessages([]);
    clearError();
  };

  const copyMessage = async (content: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    } catch {
      // clipboard not available
    }
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Suggested prompt text with ticker substitution
  const getSuggestion = (key: string) => {
    const text = t(key as any);
    if (selectedTickers.length > 0) {
      return text.replace('{ticker}', selectedTickers[0]).replace('{ticker2}', selectedTickers[1] || 'SPY');
    }
    return text;
  };

  const showEmpty = messages.length === 0 && !isStreaming;

  return (
    <GlassCard
      className="h-full"
      headerRight={
        <button
          onClick={clearChat}
          className="text-neutral hover:text-accent transition-none p-0.5"
          title={t('aiChatClear')}
        >
          <Trash2 className="w-3 h-3" />
        </button>
      }
    >
      <div className="flex flex-col h-full bg-black">
        {/* Ticker Bar */}
        <div className="flex items-center gap-1 px-2 py-1 border-b border-border bg-[#050505] flex-wrap min-h-[28px]">
          {selectedTickers.map((sym) => {
            const q = quoteMap.get(sym);
            const changeColor = q && q.change != null
              ? q.change >= 0 ? 'text-bullish' : 'text-bearish'
              : '';
            return (
              <span
                key={sym}
                className="inline-flex items-center gap-1 bg-[#111] border border-border/50 px-1.5 py-0.5 text-[9px] font-mono font-bold"
              >
                <span className="text-accent">{sym}</span>
                {q && (
                  <>
                    <span className="text-white">${q.price.toFixed(2)}</span>
                    <span className={changeColor}>
                      {(q.changePercent ?? 0) >= 0 ? '+' : ''}{q.changePercent?.toFixed(2) ?? '?'}%
                    </span>
                  </>
                )}
                <button
                  onClick={() => removeTicker(sym)}
                  className="text-neutral/40 hover:text-bearish ml-0.5"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            );
          })}

          <div className="relative">
            <button
              onClick={() => {
                setShowTickerSearch(true);
                setTimeout(() => tickerInputRef.current?.focus(), 0);
              }}
              className="inline-flex items-center gap-0.5 text-[9px] font-mono text-neutral/60 hover:text-accent uppercase"
            >
              <Plus className="w-3 h-3" />
              {selectedTickers.length === 0 ? t('aiChatAddTicker') : ''}
            </button>

            {showTickerSearch && (
              <div className="absolute top-full left-0 mt-1 z-50" ref={searchDropdownRef}>
                <input
                  ref={tickerInputRef}
                  type="text"
                  value={tickerQuery}
                  onChange={(e) => setTickerQuery(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && tickerQuery.trim()) {
                      addTicker(tickerQuery.trim());
                    }
                    if (e.key === 'Escape') setShowTickerSearch(false);
                  }}
                  placeholder="TICKER..."
                  className="w-44 bg-[#0a0a0a] border border-border text-[10px] font-mono text-white px-1.5 py-1 outline-none focus:border-accent uppercase"
                />
                {tickerResults && tickerResults.length > 0 && (
                  <div className="bg-[#0a0a0a] border border-border border-t-0 max-h-36 overflow-auto">
                    {tickerResults.slice(0, 8).map((r) => (
                      <button
                        key={r.symbol}
                        onClick={() => addTicker(r.symbol)}
                        className="w-full text-left px-1.5 py-1 hover:bg-white/5 flex items-center gap-2"
                      >
                        <span className="text-[10px] font-mono font-bold text-accent w-16 shrink-0">
                          {r.symbol}
                        </span>
                        <span className="text-[9px] font-mono text-neutral truncate">{r.name}</span>
                        <span className="text-[8px] font-mono text-neutral/30 ml-auto shrink-0">
                          {r.exchange}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="flex items-center gap-2 px-2 py-1 bg-bearish/10 border-b border-bearish/30">
            <AlertTriangle className="w-3 h-3 text-bearish shrink-0" />
            <span className="text-[9px] font-mono text-bearish uppercase truncate">{error}</span>
            <button onClick={clearError} className="ml-auto text-neutral/40 hover:text-white shrink-0">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Messages */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-auto no-scrollbar p-2 space-y-3 relative"
        >
          {/* Empty State with suggestions */}
          {showEmpty && (
            <div className="flex flex-col items-center justify-center h-full gap-4 px-4">
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-1.5 text-ai/40">
                  <TrendingUp className="w-5 h-5" />
                  <TrendingDown className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono text-neutral/40 uppercase tracking-wider text-center">
                  {selectedTickers.length === 0 ? t('aiChatNoTickers') : t('aiChatReady')}
                </span>
              </div>

              {selectedTickers.length > 0 && (
                <div className="flex flex-col gap-1 w-full max-w-xs">
                  {SUGGESTED_PROMPTS_KEYS.map((key) => (
                    <button
                      key={key}
                      onClick={() => handleSend(getSuggestion(key))}
                      className="text-left px-2 py-1.5 border border-border/50 bg-[#050505] hover:border-accent/50 hover:bg-[#0a0a0a] text-[10px] font-mono text-neutral/70 hover:text-neutral transition-none uppercase"
                    >
                      &gt; {getSuggestion(key)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Message list */}
          {messages.map((msg, i) => (
            <div key={i} className="group flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span
                  className={`text-[9px] font-mono font-bold uppercase tracking-wider ${
                    msg.role === 'user' ? 'text-accent' : 'text-ai'
                  }`}
                >
                  {msg.role === 'user' ? t('aiChatUser') : t('aiChatAnalyst')}
                </span>
                <span className="text-[8px] font-mono text-neutral/30">{formatTime(msg.timestamp)}</span>
                {msg.role === 'assistant' && (
                  <button
                    onClick={() => copyMessage(msg.content, i)}
                    className="opacity-0 group-hover:opacity-100 text-neutral/30 hover:text-accent transition-none ml-auto"
                    title="Copy"
                  >
                    {copiedIdx === i ? (
                      <Check className="w-3 h-3 text-bullish" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                )}
              </div>

              {msg.role === 'user' ? (
                <div className="text-[11px] font-mono leading-relaxed text-neutral pl-2 border-l-2 border-accent/30 whitespace-pre-wrap">
                  {msg.content}
                </div>
              ) : (
                <Markdown
                  content={msg.content}
                  className="text-[11px] font-mono leading-relaxed text-neutral/90"
                />
              )}
            </div>
          ))}

          {/* Streaming AI response */}
          {isStreaming && streamedText && (
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-ai">
                  {t('aiChatAnalyst')}
                </span>
                <span className="w-1.5 h-1.5 bg-ai animate-pulse" />
              </div>
              <Markdown
                content={streamedText}
                className="text-[11px] font-mono leading-relaxed text-neutral/90"
              />
            </div>
          )}

          {isStreaming && !streamedText && (
            <div className="flex items-center gap-2 py-2">
              <span className="w-1.5 h-1.5 bg-ai animate-pulse" />
              <span className="text-[10px] font-mono text-ai/60 animate-pulse uppercase">
                {t('aiChatThinking')}
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Scroll to bottom button */}
        {!isNearBottom && messages.length > 0 && (
          <div className="absolute bottom-[90px] left-1/2 -translate-x-1/2 z-20">
            <button
              onClick={scrollToBottom}
              className="bg-[#111] border border-border hover:border-accent p-1 text-neutral hover:text-accent"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Input Bar */}
        <div className="flex items-end gap-1 px-2 py-1.5 border-t border-border bg-[#050505]">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('aiChatPlaceholder')}
            disabled={isStreaming}
            rows={1}
            className="flex-1 bg-transparent text-[11px] font-mono text-white placeholder:text-neutral/30 outline-none resize-none min-h-[24px] max-h-[120px] py-0.5 leading-relaxed"
          />
          {isStreaming ? (
            <button
              onClick={abort}
              className="p-1 text-bearish hover:text-white transition-none shrink-0 mb-0.5"
              title={t('aiChatStop')}
            >
              <Square className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={() => handleSend()}
              disabled={!inputValue.trim()}
              className="p-1 text-accent hover:text-white transition-none disabled:text-neutral/20 shrink-0 mb-0.5"
              title={t('aiChatSend')}
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Disclaimer */}
        <div className="px-2 py-1 border-t border-border bg-[#0a0a0a]">
          <p className="text-[8px] font-mono text-neutral/40 uppercase tracking-wider">
            <span className="text-bearish/60 font-bold">⚠</span> {t('aiChatDisclaimer')}
          </p>
        </div>
      </div>
    </GlassCard>
  );
}
