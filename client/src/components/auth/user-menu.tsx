import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../../stores/use-auth-store';
import { useAuthActions } from '../../api/hooks/use-auth';
import { useT } from '../../i18n';
import { LogOut, User, Download, Trash2 } from 'lucide-react';

export function UserMenu() {
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const setLoginModalOpen = useAuthStore((s) => s.setLoginModalOpen);
  const { logout } = useAuthActions();

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
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-1.5 px-2 py-1 border border-border bg-black text-[10px] font-mono text-accent hover:border-accent"
      >
        <User className="w-3 h-3" />
        <span className="max-w-[100px] truncate">
          {user.name || user.email.split('@')[0]}
        </span>
      </button>

      {/* Dropdown */}
      {menuOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-black border border-border z-50">
          <div className="px-3 py-2 border-b border-border">
            <p className="text-[10px] font-mono text-neutral truncate">{user.email}</p>
          </div>

          <button
            onClick={async () => {
              setMenuOpen(false);
              try {
                const res = await fetch('/api/auth/me/export', { credentials: 'include' });
                const data = await res.json();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'my-data-export.json';
                a.click();
                URL.revokeObjectURL(url);
              } catch { /* ignore */ }
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-mono text-neutral hover:text-white hover:bg-white/5 text-left border-t border-border"
          >
            <Download className="w-3 h-3" />
            {t('exportData')}
          </button>

          <button
            onClick={async () => {
              if (!confirm(t('deleteAccountConfirm'))) return;
              setMenuOpen(false);
              try {
                await fetch('/api/auth/me', { method: 'DELETE', credentials: 'include' });
                logout();
              } catch { /* ignore */ }
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-mono text-neutral hover:text-bearish hover:bg-bearish/5 text-left"
          >
            <Trash2 className="w-3 h-3" />
            {t('deleteAccount')}
          </button>

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
