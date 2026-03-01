import { useState } from 'react';
import { GlassCard } from '../common/glass-card';
import {
  useAlerts,
  useCreateAlert,
  useUpdateAlert,
  useDeleteAlert,
  type Alert,
} from '../../api/hooks/use-alerts';
import { Bell, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

const ALERT_TYPES = [
  'Price Cross',
  'Price Change %',
  'Sentiment Shift',
  'News Keyword',
  'Volume Spike',
] as const;

type AlertType = typeof ALERT_TYPES[number];

function getConditionPlaceholder(type: AlertType): string {
  switch (type) {
    case 'Price Cross': return 'e.g. above:150.00';
    case 'Price Change %': return 'e.g. change:5';
    case 'Sentiment Shift': return 'e.g. direction:bearish';
    case 'News Keyword': return 'e.g. keyword:earnings';
    case 'Volume Spike': return 'e.g. multiplier:3';
  }
}

function needsSymbol(type: AlertType): boolean {
  return type !== 'News Keyword' && type !== 'Sentiment Shift';
}

function AlertRow({ alert: a, onToggle, onDelete }: {
  alert: Alert;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const triggerCount = a._count?.triggers ?? 0;

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 border-b border-border/10 hover:bg-accent/[0.04] transition-colors ${
        !a.enabled ? 'opacity-40' : ''
      }`}
    >
      {/* Toggle */}
      <button
        onClick={onToggle}
        className={`w-6 h-3 rounded-full relative transition-colors shrink-0 ${
          a.enabled ? 'bg-bullish/60' : 'bg-neutral/20'
        }`}
      >
        <div
          className={`w-2.5 h-2.5 rounded-full bg-white absolute top-0.5 transition-all ${
            a.enabled ? 'left-3' : 'left-0.5'
          }`}
        />
      </button>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-bold text-gray-200 truncate">{a.name}</span>
          {triggerCount > 0 && (
            <span className="px-1 py-0.5 text-[7px] font-mono font-bold bg-accent/20 text-accent border border-accent/30 shrink-0">
              {triggerCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[8px] font-mono text-neutral/40 uppercase">{a.type}</span>
          {a.symbol && (
            <span className="text-[8px] font-mono text-accent/60">{a.symbol}</span>
          )}
          <span className="text-[8px] font-mono text-neutral/30 truncate">{a.condition}</span>
        </div>
      </div>

      {/* Delete */}
      <button
        onClick={onDelete}
        className="p-1 text-neutral/30 hover:text-bearish transition-colors shrink-0"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

function CreateAlertForm({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<AlertType>('Price Cross');
  const [symbol, setSymbol] = useState('');
  const [condition, setCondition] = useState('');
  const createAlert = useCreateAlert();

  const handleSubmit = () => {
    if (!name.trim() || !condition.trim()) return;
    createAlert.mutate(
      {
        name: name.trim(),
        type,
        symbol: needsSymbol(type) ? symbol.toUpperCase() : undefined,
        condition: condition.trim(),
      },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <div className="px-3 py-2 bg-accent/5 border-b border-accent/20 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-mono font-bold text-accent uppercase tracking-wider">
          New Alert
        </span>
        <button onClick={onClose} className="text-neutral/40 hover:text-white transition-colors">
          <ChevronUp className="w-3 h-3" />
        </button>
      </div>

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Alert Name"
        className="w-full bg-black/40 border border-border/50 px-2 py-1 text-[10px] font-mono text-gray-200 placeholder:text-neutral/30 outline-none focus:border-accent/50"
      />

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-0.5">
          <label className="text-[8px] font-mono text-neutral/40 uppercase">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as AlertType)}
            className="bg-black/40 border border-border/50 px-2 py-1 text-[10px] font-mono text-gray-200 outline-none focus:border-accent/50 appearance-none"
          >
            {ALERT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        {needsSymbol(type) && (
          <div className="flex flex-col gap-0.5">
            <label className="text-[8px] font-mono text-neutral/40 uppercase">Symbol</label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="AAPL"
              className="bg-black/40 border border-border/50 px-2 py-1 text-[10px] font-mono text-gray-200 placeholder:text-neutral/30 outline-none focus:border-accent/50"
            />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-0.5">
        <label className="text-[8px] font-mono text-neutral/40 uppercase">Condition</label>
        <input
          type="text"
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
          placeholder={getConditionPlaceholder(type)}
          className="w-full bg-black/40 border border-border/50 px-2 py-1 text-[10px] font-mono text-gray-200 placeholder:text-neutral/30 outline-none focus:border-accent/50"
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={!name.trim() || !condition.trim() || createAlert.isPending}
        className="w-full py-1.5 bg-accent/20 text-accent text-[10px] font-mono font-bold uppercase tracking-wider hover:bg-accent/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {createAlert.isPending ? 'Creating...' : 'Create Alert'}
      </button>
    </div>
  );
}

export function AlertsPanel() {
  const [showCreate, setShowCreate] = useState(false);
  const { data: alerts, isLoading, error } = useAlerts();
  const updateAlert = useUpdateAlert();
  const deleteAlert = useDeleteAlert();

  return (
    <GlassCard
      title={
        <span className="flex items-center gap-1.5">
          <Bell className="w-3 h-3" />
          ALERTS
        </span>
      }
      headerRight={
        <div className="flex items-center gap-2">
          <span className="text-[8px] font-mono text-neutral/50">
            {alerts?.length ?? 0}
          </span>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="p-0.5 text-neutral hover:text-accent transition-colors"
          >
            {showCreate ? <ChevronUp className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          </button>
        </div>
      }
      className="h-full"
    >
      {/* Create form */}
      {showCreate && <CreateAlertForm onClose={() => setShowCreate(false)} />}

      {/* Alert list */}
      <div className="flex-1 overflow-auto no-scrollbar">
        {isLoading && (
          <div className="flex items-center justify-center py-8 text-[10px] font-mono text-neutral/40 uppercase tracking-widest">
            Loading...
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center py-8 text-[10px] font-mono text-bearish/60 uppercase tracking-widest">
            Failed to load alerts
          </div>
        )}
        {!isLoading && !error && (!alerts || alerts.length === 0) && (
          <div className="flex items-center justify-center py-8 text-[10px] font-mono text-neutral/40 uppercase tracking-widest">
            No alerts configured
          </div>
        )}
        {alerts?.map((alert) => (
          <AlertRow
            key={alert.id}
            alert={alert}
            onToggle={() => updateAlert.mutate({ id: alert.id, enabled: !alert.enabled })}
            onDelete={() => deleteAlert.mutate(alert.id)}
          />
        ))}
      </div>
    </GlassCard>
  );
}
