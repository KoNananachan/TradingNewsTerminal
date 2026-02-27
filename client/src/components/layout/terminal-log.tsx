import { useEffect, useRef } from 'react';
import { useAppStore, type LogEntry } from '../../stores/use-app-store';
import { Trash2 } from 'lucide-react';

const TYPE_COLORS: Record<LogEntry['type'], string> = {
  info: 'text-neutral',
  ws: 'text-accent',
  trade: 'text-orange',
  alert: 'text-bearish',
};

const TYPE_LABELS: Record<LogEntry['type'], string> = {
  info: 'INFO',
  ws: 'WS',
  trade: 'TRADE',
  alert: 'ALERT',
};

export function TerminalLog() {
  const logEntries = useAppStore((s) => s.logEntries);
  const clearLog = useAppStore((s) => s.clearLog);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logEntries]);

  return (
    <div className="h-full bg-black flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-1 border-b border-border/30 bg-black/40 shrink-0">
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-accent font-mono">
          Activity Log
        </span>
        <button
          onClick={clearLog}
          className="text-neutral hover:text-bearish transition-colors p-0.5"
          title="Clear Log"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-1 font-mono text-[10px] leading-relaxed no-scrollbar">
        {logEntries.length === 0 ? (
          <div className="text-neutral/30 text-center py-4 uppercase tracking-widest text-[9px]">
            Awaiting activity...
          </div>
        ) : (
          [...logEntries].reverse().map((entry, i) => (
            <div key={i} className="flex gap-2 py-0.5">
              <span className="text-neutral/40 shrink-0">[{entry.time}]</span>
              <span className={`shrink-0 font-black ${TYPE_COLORS[entry.type]}`}>
                {TYPE_LABELS[entry.type]}
              </span>
              <span className="text-gray-400 truncate">{entry.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
