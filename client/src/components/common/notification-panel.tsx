import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCheck, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { useAppStore } from '../../stores/use-app-store';

function timeAgo(date: Date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const sentimentIcon = (s: string | null) => {
  if (s === 'BULLISH') return <TrendingUp className="w-3 h-3 text-bullish" />;
  if (s === 'BEARISH') return <TrendingDown className="w-3 h-3 text-bearish" />;
  return <AlertTriangle className="w-3 h-3 text-neutral" />;
};

export function NotificationPanel() {
  const open = useAppStore((s) => s.notifPanelOpen);
  const notifications = useAppStore((s) => s.notifications);
  const markRead = useAppStore((s) => s.markRead);
  const markAllRead = useAppStore((s) => s.markAllRead);
  const setNotifPanelOpen = useAppStore((s) => s.setNotifPanelOpen);
  const setSelectedArticleId = useAppStore((s) => s.setSelectedArticleId);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        // Check if the click was on the bell button (parent handles toggle)
        const bellBtn = (e.target as HTMLElement).closest('[data-bell-btn]');
        if (!bellBtn) setNotifPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, setNotifPanelOpen]);

  const visible = notifications.slice(0, 30);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, y: -8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.96 }}
          transition={{ duration: 0.15 }}
          className="absolute right-0 top-full mt-2 w-96 max-h-[480px] bg-black/95 border border-border/60 rounded-lg shadow-[0_8px_40px_rgba(0,0,0,0.8)] backdrop-blur-xl overflow-hidden z-50 flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-300">Notifications</span>
            {notifications.some((n) => !n.read) && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-[10px] text-accent hover:text-white transition-colors font-mono"
              >
                <CheckCheck className="w-3 h-3" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {visible.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-xs text-neutral">
                No notifications yet
              </div>
            ) : (
              visible.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    markRead(n.id);
                    setSelectedArticleId(n.id);
                    setNotifPanelOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 border-b border-border/20 hover:bg-white/5 transition-colors group ${
                    n.read ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Unread dot */}
                    <div className="mt-1.5 shrink-0">
                      {!n.read ? (
                        <div className="w-2 h-2 rounded-full bg-accent shadow-[0_0_6px_rgba(34,197,94,0.6)]" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-border/50" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-gray-200 leading-snug line-clamp-2 group-hover:text-white transition-colors">
                        {n.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] text-neutral font-mono">{timeAgo(n.time)}</span>
                        {n.symbols.slice(0, 3).map((s) => (
                          <span
                            key={s}
                            className="px-1.5 py-0.5 bg-white/5 border border-border/30 rounded text-[9px] font-mono font-bold text-gray-400"
                          >
                            ${s}
                          </span>
                        ))}
                        <span className="ml-auto">{sentimentIcon(n.sentiment)}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
