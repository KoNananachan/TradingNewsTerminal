import { useState, useEffect } from 'react';
import { useT } from '../../i18n';

const STORAGE_KEY = 'onboarding-panels-seen';

export function OnboardingTooltip() {
  const t = useT();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return;

    const showTimer = setTimeout(() => setVisible(true), 3000);
    const hideTimer = setTimeout(() => {
      setVisible(false);
      localStorage.setItem(STORAGE_KEY, '1');
    }, 13000); // 3s delay + 10s display

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, '1');
  };

  return (
    <div className="absolute top-full mt-2 right-0 z-50 w-64 bg-black border border-accent p-3 animate-in fade-in slide-in-from-top-1 duration-200">
      {/* Arrow pointing up */}
      <div className="absolute -top-1.5 right-4 w-3 h-3 bg-black border-l border-t border-accent rotate-45" />

      <p className="text-[10px] font-mono text-white leading-relaxed mb-2">
        {t('onboardingPanels')}
      </p>
      <button
        onClick={dismiss}
        className="text-[9px] font-black uppercase tracking-widest text-accent hover:text-white"
      >
        {t('gotIt')}
      </button>
    </div>
  );
}
