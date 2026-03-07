import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/use-auth-store';
import { useT } from '../../i18n';
import { AlertTriangle } from 'lucide-react';

const DISCLAIMER_KEY = 'tnt-disclaimer-accepted';

export function DisclaimerModal() {
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (user && !localStorage.getItem(DISCLAIMER_KEY)) {
      setVisible(true);
    }
  }, [user]);

  if (!visible) return null;

  const accept = () => {
    localStorage.setItem(DISCLAIMER_KEY, '1');
    setVisible(false);
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-black border border-border p-6 mx-4">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-yellow-500" />
          <h2 className="text-sm font-black uppercase tracking-widest text-yellow-500">
            {t('disclaimerTitle')}
          </h2>
        </div>

        <p className="text-[11px] font-mono text-neutral leading-relaxed mb-6">
          {t('disclaimerBody')}
        </p>

        <button
          onClick={accept}
          className="w-full py-2.5 bg-accent text-black text-[11px] font-black uppercase tracking-widest hover:bg-accent/90"
        >
          {t('disclaimerAccept')}
        </button>
      </div>
    </div>
  );
}
