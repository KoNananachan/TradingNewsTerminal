import { useAppStore } from '../../stores/use-app-store';
import { useT } from '../../i18n';

const INDICATORS = [
  { key: 'rsi', label: 'RSI' },
  { key: 'macd', label: 'MACD' },
  { key: 'bb', label: 'BB' },
  { key: 'atr', label: 'ATR' },
  { key: 'vwap', label: 'VWAP' },
] as const;

const DRAWING_TOOLS = [
  { key: 'trendline', tKey: 'trendLine' as const, icon: '\u{1F4CF}' },
  { key: 'fibonacci', tKey: 'fibonacci' as const, icon: '\u{1F4D0}' },
  { key: 'hline', tKey: 'hLine' as const, icon: '\u2014' },
] as const;

export function IndicatorToolbar() {
  const t = useT();
  const indicatorConfig = useAppStore((s) => s.indicatorConfig);
  const toggleIndicator = useAppStore((s) => s.toggleIndicator);
  const activeDrawingTool = useAppStore((s) => s.activeDrawingTool);
  const setActiveDrawingTool = useAppStore((s) => s.setActiveDrawingTool);
  const clearChartDrawings = useAppStore((s) => s.clearChartDrawings);

  return (
    <div className="flex items-center gap-0.5 px-2 py-1 bg-black/30 border-b border-border/20 shrink-0 overflow-x-auto no-scrollbar">
      {/* Indicator toggles */}
      {INDICATORS.map((ind) => {
        const active = !!indicatorConfig[ind.key];
        return (
          <button
            key={ind.key}
            onClick={() => toggleIndicator(ind.key)}
            className={`px-2 py-0.5 text-[9px] font-mono font-black uppercase tracking-wider transition-all ${
              active
                ? 'bg-accent/20 text-accent border border-accent/30'
                : 'text-neutral/40 hover:text-white border border-transparent hover:border-border/30'
            }`}
            title={`Toggle ${ind.label}`}
          >
            {ind.label}
          </button>
        );
      })}

      {/* Separator */}
      <div className="w-px h-4 bg-border/30 mx-1" />

      {/* Drawing tools */}
      {DRAWING_TOOLS.map((tool) => {
        const active = activeDrawingTool === tool.key;
        return (
          <button
            key={tool.key}
            onClick={() => setActiveDrawingTool(active ? null : tool.key)}
            className={`px-2 py-0.5 text-[9px] font-mono font-bold transition-all flex items-center gap-1 ${
              active
                ? 'bg-accent/20 text-accent border border-accent/30'
                : 'text-neutral/40 hover:text-white border border-transparent hover:border-border/30'
            }`}
            title={t(tool.tKey)}
          >
            <span className="text-[10px]">{tool.icon}</span>
            {t(tool.tKey)}
          </button>
        );
      })}

      {/* Clear drawings */}
      <button
        onClick={() => {
          clearChartDrawings();
          setActiveDrawingTool(null);
        }}
        className="px-2 py-0.5 text-[9px] font-mono text-neutral/30 hover:text-bearish transition-all border border-transparent hover:border-bearish/30"
        title={t('clearDrawings')}
      >
        {'\u{1F5D1}'} {t('clearDrawings')}
      </button>
    </div>
  );
}
