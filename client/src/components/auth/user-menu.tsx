import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../../stores/use-auth-store';
import { useAuthActions } from '../../api/hooks/use-auth';
import { useT } from '../../i18n';
import { LogOut, CreditCard, User } from 'lucide-react';

export function UserMenu() {
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const isPro = useAuthStore((s) => s.isPro);
  const setLoginModalOpen = useAuthStore((s) => s.setLoginModalOpen);
  const setUpgradeModalOpen = useAuthStore((s) => s.setUpgradeModalOpen);
  const { logout, openPortal } = useAuthActions();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  if (!user) {
    return (
      <button
        onClick={() => setLoginModalOpen(true)}
        className="flex items-center gap-1.5 px-2 py-1 border border-accent bg-black text-accent text-[10px] font-bold font-mono uppercase tracking-widest hover:bg-accent hover:text-black transition-colors"
      >
        {t('login')}
      </button>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <div className="flex items-center gap-2">
        {!isPro() && (
          <button
            onClick={() => setUpgradeModalOpen(true)}
            className="px-2 py-0.5 bg-accent text-black text-[9px] font-black uppercase tracking-widest hover:bg-accent/90"
          >
            Pro
          </button>
        )}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-1.5 px-2 py-1 border border-border bg-black text-[10px] font-mono text-accent hover:border-accent"
        >
          <User className="w-3 h-3" />
          <span className="max-w-[100px] truncate">
            {user.name || user.email.split('@')[0]}
          </span>
          {isPro() && (
            <span className="px-1 py-px bg-accent/20 text-accent text-[8px] font-black">{t('proBadge')}</span>
          )}
        </button>
      </div>

      {/* Dropdown */}
      {menuOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-black border border-border z-50">
          <div className="px-3 py-2 border-b border-border">
            <p className="text-[10px] font-mono text-neutral truncate">{user.email}</p>
            <p className="text-[9px] font-bold uppercase tracking-widest mt-0.5 text-accent">
              {isPro() ? t('proPlan') : t('freePlan')}
            </p>
          </div>

          {isPro() ? (
            <button
              onClick={() => { openPortal(); setMenuOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-mono text-neutral hover:text-white hover:bg-white/5 text-left"
            >
              <CreditCard className="w-3 h-3" />
              {t('manageSubscription')}
            </button>
          ) : (
            <button
              onClick={() => { setUpgradeModalOpen(true); setMenuOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-mono text-accent hover:bg-accent/5 text-left"
            >
              <CreditCard className="w-3 h-3" />
              {t('upgradeToPro')}
            </button>
          )}

          <button
            onClick={() => { logout(); setMenuOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-mono text-neutral hover:text-bearish hover:bg-bearish/5 text-left border-t border-border"
          >
            <LogOut className="w-3 h-3" />
            {t('logout')}
          </button>
        </div>
      )}
    </div>
  );
}
