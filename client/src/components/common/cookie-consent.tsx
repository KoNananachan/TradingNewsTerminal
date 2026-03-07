import { useState, useEffect } from 'react';
import { useT } from '../../i18n';

const CONSENT_KEY = 'tnt-cookie-consent';

export function CookieConsent() {
  const t = useT();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(CONSENT_KEY)) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const accept = () => {
    localStorage.setItem(CONSENT_KEY, '1');
    setVisible(false);
  };

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] w-full max-w-lg px-4">
      <div className="bg-panel border border-border px-4 py-3 flex items-center gap-3 text-[10px] font-mono text-neutral shadow-lg">
        <p className="flex-1 leading-relaxed">
          {t('cookieConsent')}{' '}
          <a href="https://github.com/KoNananachan/TradingNewsTerminal/blob/main/PRIVACY_POLICY.md" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{t('privacyPolicy')}</a>
          {' '}{t('and')}{' '}
          <a href="https://github.com/KoNananachan/TradingNewsTerminal/blob/main/TERMS_OF_SERVICE.md" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{t('termsOfService')}</a>.
        </p>
        <button
          onClick={accept}
          className="shrink-0 px-3 py-1.5 bg-accent text-black text-[10px] font-black uppercase tracking-widest hover:bg-accent/90"
        >
          {t('cookieAccept')}
        </button>
      </div>
    </div>
  );
}
