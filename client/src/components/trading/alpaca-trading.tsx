import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../../stores/use-auth-store';
import { useAppStore } from '../../stores/use-app-store';
import { Link2, Unlink, RefreshCw, ArrowRightLeft, Wallet, History, AlertTriangle } from 'lucide-react';
import { useT } from '../../i18n';

interface AlpacaAccount {
  id: string;
  account_number: string;
  status: string;
  buying_power: string;
  cash: string;
  portfolio_value: string;
  equity: string;
  last_equity: string;
  pattern_day_trader: boolean;
  trading_blocked: boolean;
  account_blocked: boolean;
}

interface AlpacaPosition {
  asset_id: string;
  symbol: string;
  qty: string;
  side: string;
  market_value: string;
  cost_basis: string;
  unrealized_pl: string;
  unrealized_plpc: string;
  current_price: string;
  avg_entry_price: string;
}

interface AlpacaOrder {
  id: string;
  symbol: string;
  qty: string;
  notional: string | null;
  side: string;
  type: string;
  status: string;
  filled_avg_price: string | null;
  created_at: string;
}

type Tab = 'trade' | 'positions' | 'orders';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/alpaca${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || res.statusText);
  }
  return res.json();
}

export function AlpacaTrading() {
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const hasAlpaca = user?.hasAlpaca ?? false;
  const alpacaPaper = user?.alpacaPaper ?? true;

  const [activeTab, setActiveTab] = useState<Tab>('trade');
  const [account, setAccount] = useState<AlpacaAccount | null>(null);
  const [positions, setPositions] = useState<AlpacaPosition[]>([]);
  const [orders, setOrders] = useState<AlpacaOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Connect form state
  const [apiKey, setApiKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [paper, setPaper] = useState(true);
  const [connecting, setConnecting] = useState(false);

  // Trade form state
  const tradingCoin = useAppStore((s) => s.tradingCoin);
  const [symbol, setSymbol] = useState('AAPL');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [qty, setQty] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderResult, setOrderResult] = useState('');
  const addLogEntry = useAppStore((s) => s.addLogEntry);

  useEffect(() => {
    if (tradingCoin) setSymbol(tradingCoin);
  }, [tradingCoin]);

  const loadData = useCallback(async () => {
    if (!hasAlpaca) return;
    setLoading(true);
    setError('');
    try {
      const [acc, pos, ord] = await Promise.all([
        apiFetch<AlpacaAccount>('/account'),
        apiFetch<AlpacaPosition[]>('/positions'),
        apiFetch<AlpacaOrder[]>('/orders?status=all&limit=10'),
      ]);
      setAccount(acc);
      setPositions(pos);
      setOrders(ord);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [hasAlpaca]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleConnect = async () => {
    if (!apiKey || !secretKey) return;
    setConnecting(true);
    setError('');
    try {
      await apiFetch('/connect', {
        method: 'POST',
        body: JSON.stringify({ apiKey, secretKey, paper }),
      });
      // Refresh user state
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      const data = await res.json();
      if (data.user) useAuthStore.getState().setUser(data.user);
      setApiKey('');
      setSecretKey('');
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await apiFetch('/disconnect', { method: 'POST' });
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    const data = await res.json();
    if (data.user) useAuthStore.getState().setUser(data.user);
    setAccount(null);
    setPositions([]);
    setOrders([]);
  };

  const handleOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qty || !symbol) return;
    setOrderLoading(true);
    setOrderResult('');
    try {
      const payload: Record<string, unknown> = { symbol, side, type: orderType, qty: parseFloat(qty) };
      if (orderType === 'limit' && limitPrice) payload.limit_price = parseFloat(limitPrice);
      const order = await apiFetch<AlpacaOrder>('/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const desc = `${side.toUpperCase()} ${qty} ${symbol} @ ${orderType.toUpperCase()}`;
      setOrderResult(`Order ${order.status}: ${desc}`);
      addLogEntry({ type: 'trade', message: `[Alpaca] ${desc}` });
      setQty('');
      setLimitPrice('');
      loadData();
    } catch (err: any) {
      setOrderResult(`Error: ${err.message}`);
    } finally {
      setOrderLoading(false);
    }
  };

  // Not connected — show connect form
  if (!hasAlpaca) {
    return (
      <div className="h-full flex flex-col p-4 gap-3">
        <div className="flex items-center gap-2 mb-2">
          <Link2 className="w-4 h-4 text-accent" />
          <span className="text-[11px] font-black uppercase tracking-widest text-accent">{t('connectAlpaca')}</span>
        </div>
        <p className="text-[10px] font-mono text-neutral leading-relaxed">
          {t('alpacaDesc')}{' '}
          <a href="https://app.alpaca.markets" target="_blank" rel="noopener noreferrer" className="text-accent underline">
            alpaca.markets
          </a>
        </p>
        <input
          type="text"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={t('apiKeyId')}
          className="w-full bg-black border border-border px-3 py-2 text-[11px] font-mono text-white placeholder:text-neutral/30 focus:border-accent outline-none"
        />
        <input
          type="password"
          value={secretKey}
          onChange={(e) => setSecretKey(e.target.value)}
          placeholder={t('secretKeyLabel')}
          className="w-full bg-black border border-border px-3 py-2 text-[11px] font-mono text-white placeholder:text-neutral/30 focus:border-accent outline-none"
        />
        <label className="flex items-center gap-2 text-[10px] font-mono text-neutral cursor-pointer">
          <input
            type="checkbox"
            checked={paper}
            onChange={(e) => setPaper(e.target.checked)}
            className="accent-accent"
          />
          {t('paperTrading')}
        </label>
        <button
          onClick={handleConnect}
          disabled={connecting || !apiKey || !secretKey}
          className="w-full py-2.5 bg-accent text-black text-[11px] font-black uppercase tracking-widest hover:bg-accent/90 disabled:opacity-50"
        >
          {connecting ? t('connectingBtn') : t('connectBtn')}
        </button>
        {error && <p className="text-[10px] font-mono text-bearish">{error}</p>}
      </div>
    );
  }

  // Connected
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'trade', label: t('trade'), icon: <ArrowRightLeft className="w-3 h-3" /> },
    { id: 'positions', label: t('positions'), icon: <Wallet className="w-3 h-3" /> },
    { id: 'orders', label: t('orders'), icon: <History className="w-3 h-3" /> },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Account summary bar */}
      {account && (
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/30 bg-black/40 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono text-neutral">
              {t('equity')} <span className="text-white font-bold">${fmtUsd(parseFloat(account.equity))}</span>
            </span>
            <span className="text-[10px] font-mono text-neutral">
              {t('buyingPower')} <span className="text-accent font-bold">${fmtUsd(parseFloat(account.buying_power))}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            {alpacaPaper && (
              <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30">{t('paperBadge')}</span>
            )}
            <button onClick={loadData} className="text-neutral hover:text-accent p-0.5" title="Refresh">
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={handleDisconnect} className="text-neutral hover:text-bearish p-0.5" title="Disconnect">
              <Unlink className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border/30 bg-black/40 shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-[9px] font-black uppercase tracking-widest border-b-2 ${
              activeTab === tab.id
                ? 'border-accent text-accent bg-accent/5'
                : 'border-transparent text-neutral/50 hover:text-neutral hover:bg-white/[0.02]'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto no-scrollbar">
        {error && (
          <div className="px-3 py-2 bg-bearish/10 border-b border-bearish/30 flex items-center gap-2">
            <AlertTriangle className="w-3 h-3 text-bearish shrink-0" />
            <span className="text-[10px] font-mono text-bearish">{error}</span>
          </div>
        )}

        {/* Trade Tab */}
        {activeTab === 'trade' && (
          <form onSubmit={handleOrder} className="flex flex-col gap-2 p-3">
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder={t('symbolPlaceholder')}
              className="w-full bg-black/60 border border-border/40 px-3 py-2 text-[12px] font-mono text-white placeholder:text-neutral/30"
            />
            <div className="grid grid-cols-2 gap-1">
              <button type="button" onClick={() => setSide('buy')}
                className={`py-2 text-[11px] font-black uppercase tracking-widest border ${side === 'buy' ? 'bg-bullish/20 text-bullish border-bullish' : 'bg-black text-neutral/50 border-border/30'}`}>
                {t('buy')}
              </button>
              <button type="button" onClick={() => setSide('sell')}
                className={`py-2 text-[11px] font-black uppercase tracking-widest border ${side === 'sell' ? 'bg-bearish/20 text-bearish border-bearish' : 'bg-black text-neutral/50 border-border/30'}`}>
                {t('sell')}
              </button>
            </div>
            <div className="flex gap-2">
              {(['market', 'limit'] as const).map((ot) => (
                <button key={ot} type="button" onClick={() => setOrderType(ot)}
                  className={`flex-1 py-1 text-[9px] font-bold uppercase tracking-widest border ${orderType === ot ? 'text-accent border-accent bg-accent/5' : 'text-neutral/40 border-border/20'}`}>
                  {t(ot)}
                </button>
              ))}
            </div>
            <input
              type="number" step="any" value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder={t('quantity')}
              className="w-full bg-black/60 border border-border/40 px-3 py-2 text-[12px] font-mono text-white placeholder:text-neutral/30"
            />
            {orderType === 'limit' && (
              <input
                type="number" step="any" value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                placeholder={t('limitPriceLabel')}
                className="w-full bg-black/60 border border-border/40 px-3 py-2 text-[12px] font-mono text-white placeholder:text-neutral/30"
              />
            )}
            <button type="submit" disabled={orderLoading || !qty || !symbol}
              className={`py-2.5 text-[11px] font-black uppercase tracking-widest border ${
                side === 'buy'
                  ? 'bg-bullish/20 text-bullish border-bullish disabled:opacity-30'
                  : 'bg-bearish/20 text-bearish border-bearish disabled:opacity-30'
              }`}>
              {orderLoading ? t('submitting') : `${t(side)} ${symbol}`}
            </button>
            {orderResult && (
              <p className={`text-[10px] font-mono ${orderResult.startsWith('Error') ? 'text-bearish' : 'text-bullish'}`}>{orderResult}</p>
            )}
          </form>
        )}

        {/* Positions Tab */}
        {activeTab === 'positions' && (
          <div className="flex flex-col">
            {positions.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <span className="text-[10px] font-mono text-neutral uppercase">{t('noOpenPositions')}</span>
              </div>
            ) : (
              positions.map((pos) => {
                const pl = parseFloat(pos.unrealized_pl);
                const plPct = parseFloat(pos.unrealized_plpc) * 100;
                return (
                  <div key={pos.asset_id} className="px-3 py-2 border-b border-border/30 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-mono font-bold text-white">{pos.symbol}</span>
                      <span className="text-[9px] font-mono text-neutral ml-2">{pos.qty} shares @ ${fmtUsd(parseFloat(pos.avg_entry_price))}</span>
                    </div>
                    <div className="text-right">
                      <span className={`text-[11px] font-mono font-bold ${pl >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                        {pl >= 0 ? '+' : ''}${fmtUsd(pl)}
                      </span>
                      <span className={`text-[9px] font-mono ml-1 ${pl >= 0 ? 'text-bullish/60' : 'text-bearish/60'}`}>
                        ({plPct >= 0 ? '+' : ''}{plPct.toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div className="flex flex-col">
            {orders.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <span className="text-[10px] font-mono text-neutral uppercase">{t('noRecentOrders')}</span>
              </div>
            ) : (
              orders.map((ord) => (
                <div key={ord.id} className="px-3 py-2 border-b border-border/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 border ${
                        ord.side === 'buy' ? 'text-bullish border-bullish/30 bg-bullish/10' : 'text-bearish border-bearish/30 bg-bearish/10'
                      }`}>{ord.side}</span>
                      <span className="text-[11px] font-mono font-bold text-white">{ord.symbol}</span>
                      <span className="text-[9px] font-mono text-neutral">{ord.qty || ord.notional} × {ord.type}</span>
                    </div>
                    <span className={`text-[9px] font-mono font-bold uppercase ${
                      ord.status === 'filled' ? 'text-bullish' : ord.status === 'canceled' ? 'text-neutral' : 'text-accent'
                    }`}>{ord.status}</span>
                  </div>
                  <span className="text-[8px] font-mono text-neutral/50">{new Date(ord.created_at).toLocaleString()}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function fmtUsd(n: number): string {
  if (isNaN(n)) return '0.00';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n.toFixed(2);
}
