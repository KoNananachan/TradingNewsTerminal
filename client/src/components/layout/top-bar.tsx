import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../../stores/use-app-store';
import { Activity, Search, Bell, Settings, LayoutGrid } from 'lucide-react';
import { NotificationPanel } from '../common/notification-panel';
import { SettingsPanel } from '../common/settings-panel';
import { PanelToggleMenu } from '../common/panel-toggle-menu';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export function TopBar() {
  const [localTime, setLocalTime] = useState(getLocalTime());
  const wsConnected = useAppStore((s) => s.wsConnected);
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen);

  const notifPanelOpen = useAppStore((s) => s.notifPanelOpen);
  const setNotifPanelOpen = useAppStore((s) => s.setNotifPanelOpen);
  const unreadCount = useAppStore((s) => s.unreadCount);

  const settingsPanelOpen = useAppStore((s) => s.settingsPanelOpen);
  const setSettingsPanelOpen = useAppStore((s) => s.setSettingsPanelOpen);

  const [panelMenuOpen, setPanelMenuOpen] = useState(false);
  const panelMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => setLocalTime(getLocalTime()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="bg-panel border-b border-border flex items-center justify-between px-2 h-10 shrink-0 z-20 sticky top-0">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-2 py-1 bg-accent text-black font-bold uppercase tracking-widest text-xs">
          <Activity className="w-3.5 h-3.5" />
          <span>TradingNewsTerminal</span>
        </div>
        <div className="h-5 w-px bg-border mx-1" />
        <span className="text-xs font-mono text-neutral px-2 py-0.5 border border-border bg-black">
          {localTime}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="flex items-center gap-2 bg-black border border-border px-2 py-1 text-[11px] font-mono text-neutral hover:border-accent hover:text-accent transition-none w-72"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="flex-1 text-left uppercase tracking-wider">Search...</span>
          <kbd className="hidden sm:inline-flex px-1 bg-border text-neutral text-[9px] font-bold">ALT+K</kbd>
        </button>

        <div className="flex items-center gap-2">
          {/* Panel Toggle */}
          <div className="relative" ref={panelMenuRef}>
            <button
              onClick={() => setPanelMenuOpen(!panelMenuOpen)}
              className={`text-neutral hover:text-accent transition-none p-1.5 border border-transparent hover:border-border bg-black ${
                panelMenuOpen ? 'text-accent border-border' : ''
              }`}
              title="Toggle Panels"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <PanelToggleMenu open={panelMenuOpen} onClose={() => setPanelMenuOpen(false)} containerRef={panelMenuRef} />
          </div>

          {/* Bell / Notifications */}
          <div className="relative">
            <button
              data-bell-btn
              onClick={() => setNotifPanelOpen(!notifPanelOpen)}
              className={`text-neutral hover:text-accent transition-none p-1.5 border border-transparent hover:border-border bg-black ${
                notifPanelOpen ? 'text-accent border-border' : ''
              }`}
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 flex items-center justify-center px-1 bg-bearish text-white text-[9px] font-bold leading-none">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            <NotificationPanel />
          </div>

          {/* Settings */}
          <div className="relative">
            <button
              data-settings-btn
              onClick={() => setSettingsPanelOpen(!settingsPanelOpen)}
              className={`text-neutral hover:text-accent transition-none p-1.5 border border-transparent hover:border-border bg-black ${
                settingsPanelOpen ? 'text-accent border-border' : ''
              }`}
            >
              <Settings className="w-4 h-4" />
            </button>
            <SettingsPanel />
          </div>
        </div>

        <div className="h-5 w-px bg-border mx-1" />

        <ConnectButton.Custom>
          {({ account, chain, openAccountModal, openConnectModal, mounted }) => {
            const connected = mounted && account && chain;
            return (
              <div
                {...(!mounted && {
                  'aria-hidden': true,
                  style: { opacity: 0, pointerEvents: 'none' as const, userSelect: 'none' as const },
                })}
              >
                {!connected ? (
                  <button
                    onClick={openConnectModal}
                    className="flex items-center gap-1.5 px-2 py-1 border border-accent bg-black text-accent text-[10px] font-bold font-mono uppercase tracking-widest hover:bg-accent hover:text-black transition-colors"
                  >
                    CONNECT
                  </button>
                ) : (
                  <button
                    onClick={openAccountModal}
                    className="flex items-center gap-1.5 px-2 py-1 border border-border bg-black text-[10px] font-mono text-accent hover:border-accent"
                  >
                    {account.displayName}
                  </button>
                )}
              </div>
            );
          }}
        </ConnectButton.Custom>

        <div className="h-5 w-px bg-border mx-1" />

        <div className="flex items-center gap-1.5 px-2 py-1 border border-border bg-black">
          <div
            className={`w-2 h-2 ${
              wsConnected ? 'bg-bullish' : 'bg-bearish'
            }`}
          />
          <span className={`text-[10px] font-bold font-mono uppercase tracking-widest ${wsConnected ? 'text-bullish' : 'text-bearish'}`}>
            {wsConnected ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
      </div>
    </header>
  );
}

function getLocalTime() {
  const d = new Date();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone.split('/').pop()?.replace(/_/g, ' ') || '';
  return `${time} ${tz}`;
}
