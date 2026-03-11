import { useState, useMemo } from 'react';
import { GlassCard } from '../common/glass-card';
import { useAppStore } from '../../stores/use-app-store';
import { useStockDetail } from '../../api/hooks/use-stocks';
import { useT } from '../../i18n';
import { Calculator } from 'lucide-react';

const TABS = ['Position', 'R:R', 'ATR Stop', 'Kelly', 'Max DD'] as const;
type Tab = typeof TABS[number];

const TAB_KEYS: Record<Tab, 'riskPosition' | 'riskRR' | 'riskAtrStopTab' | 'riskKellyTab' | 'riskMaxDDTab'> = {
  'Position': 'riskPosition',
  'R:R': 'riskRR',
  'ATR Stop': 'riskAtrStopTab',
  'Kelly': 'riskKellyTab',
  'Max DD': 'riskMaxDDTab',
};

function InputField({
  label,
  value,
  onChange,
  suffix,
  prefix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
  prefix?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-[8px] font-mono text-neutral/50 uppercase tracking-wider">{label}</label>
      <div className="flex items-center bg-black/40 border border-border/50 focus-within:border-accent/50 transition-colors">
        {prefix && <span className="text-[10px] font-mono text-neutral/40 pl-2">{prefix}</span>}
        <input
          type="number"
          step="any"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-transparent px-2 py-1 text-[11px] font-mono text-gray-200 outline-none w-full min-w-0"
        />
        {suffix && <span className="text-[10px] font-mono text-neutral/40 pr-2">{suffix}</span>}
      </div>
    </div>
  );
}

function ResultRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-border/10 last:border-0">
      <span className="text-[9px] font-mono text-neutral/50 uppercase">{label}</span>
      <span className={`text-[11px] font-mono font-bold ${accent ? 'text-accent' : 'text-gray-200'}`}>{value}</span>
    </div>
  );
}

function PositionSizer() {
  const t = useT();
  const [account, setAccount] = useState('10000');
  const [riskPct, setRiskPct] = useState('2');
  const [entry, setEntry] = useState('');
  const [stop, setStop] = useState('');

  const result = useMemo(() => {
    const acc = parseFloat(account);
    const risk = parseFloat(riskPct);
    const ent = parseFloat(entry);
    const stp = parseFloat(stop);
    if (!acc || !risk || !ent || !stp || ent === stp) return null;
    const riskAmount = acc * (risk / 100);
    const perShareRisk = Math.abs(ent - stp);
    const positionSize = Math.floor(riskAmount / perShareRisk);
    return { riskAmount, perShareRisk, positionSize, totalValue: positionSize * ent };
  }, [account, riskPct, entry, stop]);

  return (
    <div className="p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <InputField label={t('rcAccountSize')} value={account} onChange={setAccount} prefix="$" />
        <InputField label={t('rcRisk')} value={riskPct} onChange={setRiskPct} suffix="%" />
        <InputField label={t('rcEntryPrice')} value={entry} onChange={setEntry} prefix="$" />
        <InputField label={t('rcStopLoss')} value={stop} onChange={setStop} prefix="$" />
      </div>
      {result && (
        <div className="mt-3 border border-border/20 bg-black/20 p-2">
          <ResultRow label={t('rcPositionSize')} value={`${result.positionSize} ${t('rcShares')}`} accent />
          <ResultRow label={t('rcRiskAmount')} value={`$${result.riskAmount.toFixed(2)}`} />
          <ResultRow label={t('rcPerShareRisk')} value={`$${result.perShareRisk.toFixed(2)}`} />
          <ResultRow label={t('rcTotalValue')} value={`$${result.totalValue.toFixed(2)}`} />
        </div>
      )}
    </div>
  );
}

function RiskReward() {
  const t = useT();
  const [entry, setEntry] = useState('');
  const [stop, setStop] = useState('');
  const [target, setTarget] = useState('');

  const result = useMemo(() => {
    const ent = parseFloat(entry);
    const stp = parseFloat(stop);
    const tgt = parseFloat(target);
    if (!ent || !stp || !tgt) return null;
    const risk = Math.abs(ent - stp);
    const reward = Math.abs(tgt - ent);
    if (risk === 0) return null;
    const ratio = reward / risk;
    const riskPct = (risk / ent) * 100;
    const rewardPct = (reward / ent) * 100;
    return { risk, reward, ratio, riskPct, rewardPct };
  }, [entry, stop, target]);

  const totalPct = result ? result.riskPct + result.rewardPct : 0;
  const riskWidth = result && totalPct > 0 ? (result.riskPct / totalPct) * 100 : 50;

  return (
    <div className="p-3 space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <InputField label={t('rcEntry')} value={entry} onChange={setEntry} prefix="$" />
        <InputField label={t('rcStop')} value={stop} onChange={setStop} prefix="$" />
        <InputField label={t('rcTarget')} value={target} onChange={setTarget} prefix="$" />
      </div>
      {result && (
        <div className="mt-3 space-y-2">
          {/* Proportion bar */}
          <div className="flex h-4 rounded-sm overflow-hidden">
            <div
              className="bg-bearish/60 flex items-center justify-center text-[8px] font-mono font-bold text-white"
              style={{ width: `${riskWidth}%` }}
            >
              -{result.riskPct.toFixed(1)}%
            </div>
            <div
              className="bg-bullish/60 flex items-center justify-center text-[8px] font-mono font-bold text-white"
              style={{ width: `${100 - riskWidth}%` }}
            >
              +{result.rewardPct.toFixed(1)}%
            </div>
          </div>
          <div className="border border-border/20 bg-black/20 p-2">
            <ResultRow label={t('rcRRRatio')} value={`1:${result.ratio.toFixed(2)}`} accent />
            <ResultRow label={t('rcRiskLabel')} value={`$${result.risk.toFixed(2)}`} />
            <ResultRow label={t('rcReward')} value={`$${result.reward.toFixed(2)}`} />
          </div>
        </div>
      )}
    </div>
  );
}

function AtrStop() {
  const t = useT();
  const selectedSymbol = useAppStore((s) => s.selectedSymbol);
  const { data } = useStockDetail(selectedSymbol, { range: '3mo' });

  const atrResult = useMemo(() => {
    if (!data?.history?.length) return null;
    const history = data.history.filter(
      (h) => h.high != null && h.low != null && h.close != null,
    );
    if (history.length < 15) return null;

    const period = 14;
    let atrSum = 0;
    for (let i = history.length - period; i < history.length; i++) {
      const prev = history[i - 1];
      const curr = history[i];
      const tr = Math.max(
        curr.high - curr.low,
        Math.abs(curr.high - prev.close),
        Math.abs(curr.low - prev.close),
      );
      atrSum += tr;
    }
    const atr = atrSum / period;
    const lastClose = history[history.length - 1].close;
    return { atr, lastClose, stopLong: lastClose - 2 * atr, stopShort: lastClose + 2 * atr };
  }, [data]);

  return (
    <div className="p-3 space-y-2">
      {!selectedSymbol && (
        <div className="text-[10px] font-mono text-neutral/40 uppercase text-center py-4">
          {t('selectSymbolFirst')}
        </div>
      )}
      {selectedSymbol && !atrResult && (
        <div className="text-[10px] font-mono text-neutral/40 uppercase text-center py-4">
          {t('loadingAtrData')}
        </div>
      )}
      {selectedSymbol && atrResult && (
        <div className="border border-border/20 bg-black/20 p-2">
          <div className="text-[9px] font-mono text-accent uppercase tracking-wider mb-2">{selectedSymbol}</div>
          <ResultRow label={t('rcAtr14')} value={atrResult.atr.toFixed(2)} accent />
          <ResultRow label={t('rcLastClose')} value={`$${atrResult.lastClose.toFixed(2)}`} />
          <ResultRow label={t('rcLongStop')} value={`$${atrResult.stopLong.toFixed(2)}`} />
          <ResultRow label={t('rcShortStop')} value={`$${atrResult.stopShort.toFixed(2)}`} />
          <div className="mt-2 text-[8px] font-mono text-neutral/40">
            {t('rcAtrSuggestion')}
          </div>
        </div>
      )}
    </div>
  );
}

function KellyCriterion() {
  const t = useT();
  const [winRate, setWinRate] = useState('55');
  const [winLossRatio, setWinLossRatio] = useState('1.5');

  const result = useMemo(() => {
    const w = parseFloat(winRate) / 100;
    const wl = parseFloat(winLossRatio);
    if (!w || !wl || w <= 0 || w >= 1 || wl <= 0) return null;
    const kelly = w - (1 - w) / wl;
    return { kelly, halfKelly: kelly / 2 };
  }, [winRate, winLossRatio]);

  return (
    <div className="p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <InputField label={t('rcWinRate')} value={winRate} onChange={setWinRate} suffix="%" />
        <InputField label={t('rcWinLossRatio')} value={winLossRatio} onChange={setWinLossRatio} />
      </div>
      <div className="text-[8px] font-mono text-neutral/40 mt-1">
        f* = W - (1-W) / (W/L)
      </div>
      {result && (
        <div className="mt-3 border border-border/20 bg-black/20 p-2">
          <ResultRow
            label={t('rcKellyFraction')}
            value={`${(result.kelly * 100).toFixed(2)}%`}
            accent
          />
          <ResultRow
            label={t('rcHalfKelly')}
            value={`${(result.halfKelly * 100).toFixed(2)}%`}
          />
          {result.kelly < 0 && (
            <div className="mt-1 text-[8px] font-mono text-bearish">
              {t('rcNegativeEdge')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MaxDrawdown() {
  const t = useT();
  const [equityInput, setEquityInput] = useState('10000,10500,9800,10200,9500,9900,10100');

  const result = useMemo(() => {
    const values = equityInput
      .split(',')
      .map((v) => parseFloat(v.trim()))
      .filter((v) => !isNaN(v));
    if (values.length < 2) return null;

    let peak = values[0];
    let maxDD = 0;
    let maxDDPct = 0;
    let peakIdx = 0;
    let troughIdx = 0;

    for (let i = 1; i < values.length; i++) {
      if (values[i] > peak) {
        peak = values[i];
        peakIdx = i;
      }
      const dd = peak - values[i];
      const ddPct = (dd / peak) * 100;
      if (dd > maxDD) {
        maxDD = dd;
        maxDDPct = ddPct;
        troughIdx = i;
      }
    }

    return { maxDD, maxDDPct, peak, trough: values[troughIdx], peakIdx, troughIdx };
  }, [equityInput]);

  return (
    <div className="p-3 space-y-2">
      <div className="flex flex-col gap-0.5">
        <label className="text-[8px] font-mono text-neutral/50 uppercase tracking-wider">
          {t('rcEquityCurveLabel')}
        </label>
        <textarea
          value={equityInput}
          onChange={(e) => setEquityInput(e.target.value)}
          rows={3}
          className="w-full bg-black/40 border border-border/50 px-2 py-1 text-[10px] font-mono text-gray-200 placeholder:text-neutral/30 outline-none focus:border-accent/50 resize-none"
          placeholder="10000, 10500, 9800, ..."
        />
      </div>
      {result && (
        <div className="mt-3 border border-border/20 bg-black/20 p-2">
          <ResultRow label={t('rcMaxDrawdown')} value={`$${result.maxDD.toFixed(2)}`} accent />
          <ResultRow label={t('rcMaxDrawdownPct')} value={`${result.maxDDPct.toFixed(2)}%`} accent />
          <ResultRow label={t('rcPeak')} value={`$${result.peak.toFixed(2)}`} />
          <ResultRow label={t('rcTrough')} value={`$${result.trough.toFixed(2)}`} />
        </div>
      )}
    </div>
  );
}

export function RiskCalculator() {
  const t = useT();
  const [activeTab, setActiveTab] = useState<Tab>('Position');

  return (
    <GlassCard
      title={
        <span className="flex items-center gap-1.5">
          <Calculator className="w-3 h-3" />
          {t('riskCalculator')}
        </span>
      }
      className="h-full"
    >
      {/* Tab bar */}
      <div className="shrink-0 flex items-center border-b border-border/30 bg-black/20 overflow-x-auto no-scrollbar">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-[9px] font-mono font-black uppercase tracking-wider whitespace-nowrap border-b-2 transition-all ${
              activeTab === tab
                ? 'border-accent text-accent'
                : 'border-transparent text-neutral/50 hover:text-gray-300'
            }`}
          >
            {t(TAB_KEYS[tab])}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto no-scrollbar">
        {activeTab === 'Position' && <PositionSizer />}
        {activeTab === 'R:R' && <RiskReward />}
        {activeTab === 'ATR Stop' && <AtrStop />}
        {activeTab === 'Kelly' && <KellyCriterion />}
        {activeTab === 'Max DD' && <MaxDrawdown />}
      </div>
    </GlassCard>
  );
}
