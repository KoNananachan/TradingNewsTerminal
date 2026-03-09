import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../../stores/use-app-store';
import { useT, LOCALE_LABELS, type Locale } from '../../i18n';
import { Search, Bell, Settings, LayoutGrid, Maximize2, Minimize2, Globe } from 'lucide-react';
import { NotificationPanel } from '../common/notification-panel';
import { SettingsPanel } from '../common/settings-panel';
import { PanelToggleMenu } from '../common/panel-toggle-menu';
import { OnboardingTooltip } from '../common/onboarding-tooltip';
import { UserMenu } from '../auth/user-menu';
import { WalletButton } from '../common/wallet-button';
import { useAuthStore } from '../../stores/use-auth-store';

export function TopBar() {
  const [localTime, setLocalTime] = useState(getLocalTime());
  const wsConnected = useAppStore((s) => s.wsConnected);
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen);

  const notifPanelOpen = useAppStore((s) => s.notifPanelOpen);
  const setNotifPanelOpen = useAppStore((s) => s.setNotifPanelOpen);
  const unreadCount = useAppStore((s) => s.unreadCount);

  const settingsPanelOpen = useAppStore((s) => s.settingsPanelOpen);
  const setSettingsPanelOpen = useAppStore((s) => s.setSettingsPanelOpen);
  const t = useT();
  const user = useAuthStore((s) => s.user);

  const locale = useAppStore((s) => s.locale);
  const setLocale = useAppStore((s) => s.setLocale);

  const [panelMenuOpen, setPanelMenuOpen] = useState(false);
  const panelMenuRef = useRef<HTMLDivElement>(null);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  useEffect(() => {
    if (!langMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) setLangMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [langMenuOpen]);

  useEffect(() => {
    const interval = setInterval(() => setLocalTime(getLocalTime()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="bg-panel border-b border-border flex items-center justify-between px-2 h-10 shrink-0 z-20 sticky top-0">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-2 py-1 bg-accent text-black font-bold uppercase tracking-widest text-xs">
          <img src="/logo.png" alt="Logo" className="w-4 h-4" />
          <span>TradingNews</span>
        </div>
        <div className="h-5 w-px bg-border mx-1" />
        <span className="text-xs font-mono text-neutral px-2 py-0.5 border border-border bg-black">
          {localTime}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="flex items-center gap-2 bg-black border border-border px-2 py-1 text-[11px] font-mono text-neutral hover:border-accent hover:text-accent transition-colors w-72"
        >
          <Search className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1 text-left uppercase tracking-wider truncate">{t('search')}</span>
          <kbd className="hidden sm:inline-flex px-1 bg-border text-neutral text-[9px] font-bold">ALT+K</kbd>
        </button>

        <div className="flex items-center gap-2">
          {/* Panel Toggle */}
          <div className="relative" ref={panelMenuRef}>
            <button
              onClick={() => setPanelMenuOpen(!panelMenuOpen)}
              className={`text-neutral hover:text-accent transition-colors p-1.5 border border-transparent hover:border-border bg-black ${
                panelMenuOpen ? 'text-accent border-border' : ''
              }`}
              title={t('togglePanels')}
              aria-label={t('togglePanels')}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <PanelToggleMenu open={panelMenuOpen} onClose={() => setPanelMenuOpen(false)} containerRef={panelMenuRef} />
            <OnboardingTooltip />
          </div>

          {/* Fullscreen */}
          <button
            onClick={() => {
              if (document.fullscreenElement) {
                document.exitFullscreen();
              } else {
                document.documentElement.requestFullscreen();
              }
            }}
            className="text-neutral hover:text-accent transition-colors p-1.5 border border-transparent hover:border-border bg-black"
            title={isFullscreen ? t('exitFullscreen') : t('fullscreen')}
            aria-label={isFullscreen ? t('exitFullscreen') : t('fullscreen')}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Bell / Notifications */}
          <div className="relative">
            <button
              data-bell-btn
              onClick={() => setNotifPanelOpen(!notifPanelOpen)}
              className={`text-neutral hover:text-accent transition-colors p-1.5 border border-transparent hover:border-border bg-black ${
                notifPanelOpen ? 'text-accent border-border' : ''
              }`}
              aria-label={t('notifications')}
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
              className={`text-neutral hover:text-accent transition-colors p-1.5 border border-transparent hover:border-border bg-black ${
                settingsPanelOpen ? 'text-accent border-border' : ''
              }`}
              aria-label={t('settings')}
            >
              <Settings className="w-4 h-4" />
            </button>
            <SettingsPanel />
          </div>

          {/* Language */}
          <div className="relative" ref={langMenuRef}>
            <button
              onClick={() => setLangMenuOpen(!langMenuOpen)}
              className={`text-neutral hover:text-accent transition-colors p-1.5 border border-transparent hover:border-border bg-black ${langMenuOpen ? 'text-accent border-border' : ''}`}
              aria-label={t('language')}
            >
              <Globe className="w-4 h-4" />
            </button>
            {langMenuOpen && (
              <div className="absolute right-0 top-full mt-1 bg-black border border-border z-50 py-1">
                {(Object.entries(LOCALE_LABELS) as [Locale, string][]).map(([code, label]) => (
                  <button
                    key={code}
                    onClick={() => { setLocale(code); setLangMenuOpen(false); }}
                    className={`block w-full text-left px-4 py-1.5 text-[11px] font-mono whitespace-nowrap ${
                      locale === code ? 'text-accent bg-accent/5' : 'text-neutral hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Discord */}
          <a
            href="https://discord.gg/6dr83qcJ"
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral hover:text-violet-400 transition-colors p-1.5"
            aria-label="Discord"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.79 19.79 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.74 19.74 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.11 13.11 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.3 12.3 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.84 19.84 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 00-.031-.03z"/></svg>
          </a>

          {/* GitHub */}
          <a
            href="https://github.com/KoNananachan/TradingNewsTerminal"
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral hover:text-white transition-colors p-1.5"
            aria-label="GitHub"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
          </a>
        </div>

        <div className="h-5 w-px bg-border mx-1" />

        {user && (
          <>
            <WalletButton />
            <div className="h-5 w-px bg-border mx-1" />
          </>
        )}

        <UserMenu />

        <div className="h-5 w-px bg-border mx-1" />

        <div className="flex items-center gap-1.5 px-2 py-1 border border-border bg-black">
          <div
            className={`w-2 h-2 ${
              wsConnected ? 'bg-bullish' : 'bg-bearish'
            }`}
          />
          <span className={`text-[10px] font-bold font-mono uppercase tracking-widest ${wsConnected ? 'text-bullish' : 'text-bearish'}`}>
            {wsConnected ? t('live') : t('offline')}
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
