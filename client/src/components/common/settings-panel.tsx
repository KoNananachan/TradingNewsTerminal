import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Volume2, RefreshCw, Gauge, Palette, Rss, Brain, ArrowRightLeft, Globe } from 'lucide-react';
import { useAppStore, type UserSettings } from '../../stores/use-app-store';
import { useT, LOCALE_LABELS, type Locale } from '../../i18n';

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-9 h-5 rounded-full transition-colors ${
        checked ? 'bg-accent' : 'bg-border/80'
      }`}
    >
      <div
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-4' : ''
        }`}
      />
    </button>
  );
}

function Slider({
  value,
  min,
  max,
  step,
  label,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  label: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-1 accent-accent bg-border/50 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(34,197,94,0.4)]"
      />
      <span className="text-[10px] font-mono text-neutral w-12 text-right">{label}</span>
    </div>
  );
}

export function SettingsPanel() {
  const open = useAppStore((s) => s.settingsPanelOpen);
  const settings = useAppStore((s) => s.settings);
  const setSettingsPanelOpen = useAppStore((s) => s.setSettingsPanelOpen);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const locale = useAppStore((s) => s.locale);
  const setLocale = useAppStore((s) => s.setLocale);
  const t = useT();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        const settingsBtn = (e.target as HTMLElement).closest('[data-settings-btn]');
        if (!settingsBtn) setSettingsPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, setSettingsPanelOpen]);

  const set = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) =>
    updateSettings({ [key]: value });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, y: -8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.96 }}
          transition={{ duration: 0.15 }}
          className="absolute right-0 top-full mt-2 w-80 bg-black/95 border border-border/60 rounded-lg shadow-[0_8px_40px_rgba(0,0,0,0.8)] backdrop-blur-xl overflow-hidden z-50"
        >
          {/* Header */}
          <div className="px-4 py-2.5 border-b border-border/40">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-300">{t('settings')}</span>
          </div>

          <div className="p-4 space-y-5">
            {/* Language group */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral">
                <Globe className="w-3 h-3" />
                {t('language')}
              </div>
              <div className="flex flex-wrap gap-1.5 pl-5">
                {(Object.entries(LOCALE_LABELS) as [Locale, string][]).map(([code, label]) => (
                  <button
                    key={code}
                    onClick={() => setLocale(code)}
                    className={`px-2.5 py-1.5 rounded border text-[11px] font-mono transition-all ${
                      locale === code
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border/40 text-neutral hover:border-border hover:text-gray-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notifications group */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral">
                <Bell className="w-3 h-3" />
                {t('notifications')}
              </div>
              <div className="space-y-2.5 pl-5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-300">{t('breakingAlerts')}</span>
                  <Toggle checked={settings.breakingAlerts} onChange={(v) => set('breakingAlerts', v)} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-300">{t('sound')}</span>
                  <Toggle checked={settings.soundEnabled} onChange={(v) => set('soundEnabled', v)} />
                </div>
              </div>
            </div>

            {/* Display group */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral">
                <Gauge className="w-3 h-3" />
                {t('display')}
              </div>
              <div className="space-y-3 pl-5">
                <div>
                  <span className="text-[11px] text-gray-300 block mb-1.5">{t('tickerSpeed')}</span>
                  <Slider
                    value={settings.tickerSpeed}
                    min={20}
                    max={200}
                    step={10}
                    label={`${settings.tickerSpeed}s`}
                    onChange={(v) => set('tickerSpeed', v)}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <RefreshCw className="w-3 h-3 text-neutral" />
                    <span className="text-[11px] text-gray-300">{t('autoRefresh')}</span>
                  </div>
                  <Slider
                    value={settings.autoRefreshInterval}
                    min={10}
                    max={120}
                    step={5}
                    label={`${settings.autoRefreshInterval}s`}
                    onChange={(v) => set('autoRefreshInterval', v)}
                  />
                </div>
              </div>
            </div>

            {/* Theme group */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral">
                <Palette className="w-3 h-3" />
                {t('theme')}
              </div>
              <div className="flex gap-2 pl-5">
                {(['dark', 'midnight'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => set('theme', t)}
                    className={`flex-1 px-3 py-2 rounded border text-[11px] font-mono uppercase tracking-wider transition-all ${
                      settings.theme === t
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border/40 text-neutral hover:border-border hover:text-gray-300'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Data Source */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral">
                <Rss className="w-3 h-3" />
                {t('dataSource')}
              </div>
              <div className="pl-5 space-y-1.5">
                <RadioOption
                  name="dataSource"
                  value="tradingnews"
                  label={t('tradingNewsOfficial')}
                  checked={settings.dataSource === 'tradingnews'}
                  onChange={(v) => set('dataSource', v)}
                />
                <p className="text-[9px] text-neutral/40 font-mono pl-5">{t('comingSoon')}</p>
              </div>
            </div>

            {/* AI Analysis */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral">
                <Brain className="w-3 h-3" />
                {t('aiAnalysis')}
              </div>
              <div className="pl-5 space-y-1.5">
                <RadioOption
                  name="aiProvider"
                  value="tradingnews"
                  label={t('tradingNewsOfficial')}
                  checked={settings.aiProvider === 'tradingnews'}
                  onChange={(v) => set('aiProvider', v)}
                />
                <p className="text-[9px] text-neutral/40 font-mono pl-5">{t('comingSoon')}</p>
              </div>
            </div>

            {/* Trading Channel */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral">
                <ArrowRightLeft className="w-3 h-3" />
                {t('tradingChannel')}
              </div>
              <div className="pl-5 space-y-1.5">
                <RadioOption
                  name="tradingChannel"
                  value="hyperliquid"
                  label={t('hyperLiquid')}
                  checked={settings.tradingChannel === 'hyperliquid'}
                  onChange={(v) => set('tradingChannel', v)}
                />
                <p className="text-[9px] text-neutral/40 font-mono pl-5">{t('comingSoon')}</p>
              </div>
            </div>

            {/* Community */}
            <div className="space-y-3 pt-2 border-t border-border/30">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral">
                <Globe className="w-3 h-3" />
                COMMUNITY
              </div>
              <div className="pl-5 space-y-2">
                <a
                  href="https://discord.gg/6dr83qcJ"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-[11px] font-mono text-violet-400 hover:text-violet-300 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.79 19.79 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.74 19.74 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.11 13.11 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.3 12.3 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.84 19.84 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 00-.031-.03z"/></svg>
                  Discord
                </a>
                <a
                  href="https://github.com/KoNananachan/TradingNewsWeb"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-[11px] font-mono text-neutral/60 hover:text-white transition-colors"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                  GitHub
                </a>
              </div>
            </div>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function RadioOption({
  name,
  value,
  label,
  checked,
  onChange,
}: {
  name: string;
  value: string;
  label: string;
  checked: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer group py-0.5">
      <span
        className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
          checked ? 'border-accent' : 'border-border/60 group-hover:border-border'
        }`}
        onClick={() => onChange(value)}
      >
        {checked && <span className="w-1.5 h-1.5 rounded-full bg-accent" />}
      </span>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="sr-only"
      />
      <span className={`text-[11px] font-mono ${checked ? 'text-white' : 'text-neutral/60'}`}>
        {label}
      </span>
    </label>
  );
}
