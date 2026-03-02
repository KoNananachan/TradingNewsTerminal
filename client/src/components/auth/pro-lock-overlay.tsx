import type { ReactNode } from 'react';
import { useAuthStore } from '../../stores/use-auth-store';
import { useT } from '../../i18n';
import { Lock, Zap } from 'lucide-react';

interface ProLockOverlayProps {
  children: ReactNode;
}

export function ProLockOverlay({ children }: ProLockOverlayProps) {
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const isPro = useAuthStore((s) => s.isPro);
  const setLoginModalOpen = useAuthStore((s) => s.setLoginModalOpen);
  const setUpgradeModalOpen = useAuthStore((s) => s.setUpgradeModalOpen);

  if (isPro()) {
    return <>{children}</>;
  }

  return (
    <div className="relative h-full overflow-hidden">
      {/* Blurred content */}
      <div className="h-full opacity-20 blur-sm pointer-events-none select-none">
        {children}
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-10">
        <Lock className="w-8 h-8 text-accent mb-3" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral mb-4">
          {t('proFeature')}
        </p>
        {!user ? (
          <button
            onClick={() => setLoginModalOpen(true)}
            className="px-6 py-2 border border-accent bg-black text-accent text-[11px] font-black uppercase tracking-widest hover:bg-accent hover:text-black"
          >
            {t('login')}
          </button>
        ) : (
          <button
            onClick={() => setUpgradeModalOpen(true)}
            className="px-6 py-2 bg-accent text-black text-[11px] font-black uppercase tracking-widest hover:bg-accent/90 flex items-center gap-2"
          >
            <Zap className="w-3.5 h-3.5" />
            {t('upgradeToPro')}
          </button>
        )}
      </div>
    </div>
  );
}
