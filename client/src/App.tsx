import { useEffect } from 'react';
import { AppShell } from './components/layout/app-shell';
import { NewsDetail } from './components/panels/news-detail';
import { CommandPalette } from './components/common/command-palette';
import { BreakingNewsFlash } from './components/common/breaking-news';
import { KeyboardHUD, ShortcutsModal } from './components/common/keyboard-hud';
import { LoginModal } from './components/auth/login-modal';
import { CookieConsent } from './components/common/cookie-consent';
import { DisclaimerModal } from './components/common/disclaimer-modal';
import { useWebSocket } from './realtime/use-ws';
import { useKeyboard } from './hooks/use-keyboard';
import { useSessionTracker } from './hooks/use-session-tracker';
import { useAuth } from './api/hooks/use-auth';
import { useAppStore } from './stores/use-app-store';

export default function App() {
  useWebSocket();
  useKeyboard();
  useSessionTracker();
  useAuth();
  const theme = useAppStore((s) => s.settings.theme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <>
      <AppShell />
      <LoginModal />
      <NewsDetail />
      <CommandPalette />
      <BreakingNewsFlash />
      <KeyboardHUD />
      <ShortcutsModal />
      <CookieConsent />
      <DisclaimerModal />
    </>
  );
}
