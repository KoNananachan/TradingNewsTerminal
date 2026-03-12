import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '../../stores/use-auth-store';
import { useAppStore } from '../../stores/use-app-store';
import { Link2, Unlink, RefreshCw, ArrowRightLeft, Wallet, History, AlertTriangle, X, DollarSign, Hash } from 'lucide-react';
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
  long_market_value: string;
  short_market_value: string;
  pattern_day_trader: boolean;
  trading_blocked: boolean;
  account_blocked: boolean;
  daytrade_count: number;
  daytrading_buying_power: string;
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
  change_today: string;
}

interface AlpacaOrder {
  id: string;
  symbol: string;
  qty: string;
  filled_qty: string;
  notional: string | null;
  side: string;
  type: string;
  time_in_force: string;
  status: string;
  limit_price: string | null;
  stop_price: string | null;
  filled_avg_price: string | null;
  created_at: string;
}

type Tab = 'trade' | 'positions' | 'orders';
type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit';
type TimeInForce = 'day' | 'gtc';
type SizeMode = 'qty' | 'notional';
type OrderFilter = 'all' | 'open' | 'closed';

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
  const [orderType, setOrderType] = useState<OrderType>('market');
  const [tif, setTif] = useState<TimeInForce>('day');
  const [sizeMode, setSizeMode] = useState<SizeMode>('qty');
  const [qty, setQty] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderResult, setOrderResult] = useState('');
  const [confirmOrder, setConfirmOrder] = useState(false);
  const [orderFilter, setOrderFilter] = useState<OrderFilter>('all');
  const addLogEntry = useAppStore((s) => s.addLogEntry);
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

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
        apiFetch<AlpacaOrder[]>(`/orders?status=${orderFilter}&limit=50`),
      ]);
      setAccount(acc);
      setPositions(pos);
      setOrders(ord);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [hasAlpaca, orderFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-refresh every 15s
  useEffect(() => {
    if (!hasAlpaca) return;
    refreshTimer.current = setInterval(loadData, 15_000);
    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current); };
  }, [hasAlpaca, loadData]);

  const handleConnect = async () => {
    if (!apiKey || !secretKey) return;
    setConnecting(true);
    setError('');
    try {
      await apiFetch('/connect', {
        method: 'POST',
        body: JSON.stringify({ apiKey, secretKey, paper }),
      });
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      const data = await res.json();
      if (data.user) useAuthStore.getState().setUser(data.user);
      setApiKey('');
      setSecretKey('');
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Connection failed');
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
    // Show confirmation first
    if (!confirmOrder) {
      setConfirmOrder(true);
      return;
    }
    setConfirmOrder(false);
    setOrderLoading(true);
    setOrderResult('');
    try {
      const payload: Record<string, unknown> = {
        symbol,
        side,
        type: orderType,
        time_in_force: tif,
      };
      if (sizeMode === 'qty') payload.qty = parseFloat(qty);
      else payload.notional = parseFloat(qty);
      if ((orderType === 'limit' || orderType === 'stop_limit') && limitPrice) {
        payload.limit_price = parseFloat(limitPrice);
      }
      if ((orderType === 'stop' || orderType === 'stop_limit') && stopPrice) {
        payload.stop_price = parseFloat(stopPrice);
      }
      const order = await apiFetch<AlpacaOrder>('/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const sizeStr = sizeMode === 'notional' ? `$${qty}` : `${qty}`;
      const desc = `${side.toUpperCase()} ${sizeStr} ${symbol} @ ${orderType.toUpperCase()}`;
      setOrderResult(`${order.status}: ${desc}`);
      addLogEntry({ type: 'trade', message: `[Alpaca] ${desc}` });
      setQty('');
      setLimitPrice('');
      setStopPrice('');
      loadData();
    } catch (err: unknown) {
      setOrderResult(`Error: ${err instanceof Error ? err.message : 'Failed'}`);
    } finally {
      setOrderLoading(false);
    }
  };

  const handleClosePosition = async (pos: AlpacaPosition) => {
    try {
      const closeSide = pos.side === 'long' ? 'sell' : 'buy';
      await apiFetch('/orders', {
        method: 'POST',
        body: JSON.stringify({
          symbol: pos.symbol,
          side: closeSide,
          type: 'market',
          qty: Math.abs(parseFloat(pos.qty)),
          time_in_force: 'day',
        }),
      });
      addLogEntry({ type: 'trade', message: `[Alpaca] CLOSE ${pos.symbol} ${pos.qty} shares @ MKT` });
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to close position');
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      await apiFetch(`/orders/${orderId}`, { method: 'DELETE' });
      addLogEntry({ type: 'trade', message: `[Alpaca] Cancelled order ${orderId.slice(0, 8)}` });
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to cancel order');
    }
  };

  const handlePositionClick = (pos: AlpacaPosition) => {
    setSymbol(pos.symbol);
    setActiveTab('trade');
  };

  const applyQtyPct = (pct: number) => {
    if (!account) return;
    const bp = parseFloat(account.buying_power);
    if (sizeMode === 'notional') {
      setQty((bp * pct).toFixed(2));
    } else {
      // Can't calculate shares without price, just set notional mode
      setSizeMode('notional');
      setQty((bp * pct).toFixed(2));
    }
  };

  // Feature not yet available — show placeholder
  if (!hasAlpaca) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 gap-4">
        <div className="w-12 h-12 border-2 border-accent/30 flex items-center justify-center">
          <Link2 className="w-6 h-6 text-accent/50" />
        </div>
        <span className="text-[13px] font-black uppercase tracking-widest text-accent">{t('featureTesting')}</span>
        <p className="text-[10px] font-mono text-neutral/60 leading-relaxed text-center max-w-[260px]">
          {t('featureTestingDesc')}
        </p>
      </div>
    );
  }

  // Day P&L
  const equity = account ? parseFloat(account.equity) : 0;
  const lastEquity = account ? parseFloat(account.last_equity) : 0;
  const dayPl = equity - lastEquity;
  const dayPlPct = lastEquity > 0 ? (dayPl / lastEquity) * 100 : 0;

  // Total unrealized P&L
  const totalUnrealizedPl = positions.reduce((sum, p) => sum + parseFloat(p.unrealized_pl || '0'), 0);

  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'trade', label: t('trade'), icon: <ArrowRightLeft className="w-3 h-3" /> },
    { id: 'positions', label: t('positions'), icon: <Wallet className="w-3 h-3" />, badge: positions.length > 0 ? String(positions.length) : undefined },
    { id: 'orders', label: t('orders'), icon: <History className="w-3 h-3" /> },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Account summary bar */}
      {account && (
        <div className="flex flex-col border-b border-border/30 bg-black/40 shrink-0">
          <div className="flex items-center justify-between px-3 py-1.5">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-neutral">
                {t('equity')} <span className="text-white font-bold">${fmtUsd(equity)}</span>
              </span>
              <span className={`text-[10px] font-mono font-bold ${dayPl >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                {dayPl >= 0 ? '+' : ''}{fmtUsd(dayPl)} ({dayPlPct >= 0 ? '+' : ''}{dayPlPct.toFixed(2)}%)
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
          <div className="flex items-center gap-4 px-3 pb-1.5">
            <span className="text-[9px] font-mono text-neutral/60">
              {t('buyingPower')} <span className="text-accent/80">${fmtUsd(parseFloat(account.buying_power))}</span>
            </span>
            <span className="text-[9px] font-mono text-neutral/60">
              Cash <span className="text-white/60">${fmtUsd(parseFloat(account.cash))}</span>
            </span>
            {parseFloat(account.long_market_value) > 0 && (
              <span className="text-[9px] font-mono text-neutral/60">
                Long <span className="text-white/60">${fmtUsd(parseFloat(account.long_market_value))}</span>
              </span>
            )}
            {account.pattern_day_trader && (
              <span className="text-[8px] font-black uppercase tracking-widest px-1 py-0.5 bg-bearish/20 text-bearish border border-bearish/30">PDT</span>
            )}
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
            {tab.badge && (
              <span className="text-[8px] bg-accent/20 text-accent px-1 min-w-[14px] text-center">{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto no-scrollbar">
        {error && (
          <div className="px-3 py-2 bg-bearish/10 border-b border-bearish/30 flex items-center gap-2">
            <AlertTriangle className="w-3 h-3 text-bearish shrink-0" />
            <span className="text-[10px] font-mono text-bearish flex-1">{error}</span>
            <button onClick={() => setError('')} className="text-bearish/60 hover:text-bearish"><X className="w-3 h-3" /></button>
          </div>
        )}

        {/* Trade Tab */}
        {activeTab === 'trade' && (
          <form onSubmit={handleOrder} className="flex flex-col gap-2 p-3">
            {/* Symbol */}
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder={t('symbolPlaceholder')}
              className="w-full bg-black/60 border border-border/40 px-3 py-2 text-[12px] font-mono text-white placeholder:text-neutral/30"
            />

            {/* Side */}
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

            {/* Order Type */}
            <div className="flex gap-1">
              {(['market', 'limit', 'stop', 'stop_limit'] as const).map((ot) => (
                <button key={ot} type="button" onClick={() => setOrderType(ot)}
                  className={`flex-1 py-1 text-[8px] font-bold uppercase tracking-widest border ${orderType === ot ? 'text-accent border-accent bg-accent/5' : 'text-neutral/40 border-border/20'}`}>
                  {ot === 'stop_limit' ? 'STP LMT' : ot === 'stop' ? 'STOP' : t(ot)}
                </button>
              ))}
            </div>

            {/* Time in Force */}
            <div className="flex gap-1">
              {(['day', 'gtc'] as const).map((v) => (
                <button key={v} type="button" onClick={() => setTif(v)}
                  className={`flex-1 py-1 text-[8px] font-bold uppercase tracking-widest border ${tif === v ? 'text-white border-white/30 bg-white/5' : 'text-neutral/30 border-border/20'}`}>
                  {v}
                </button>
              ))}
            </div>

            {/* Size mode + input */}
            <div className="flex gap-1">
              <button type="button" onClick={() => setSizeMode('qty')}
                className={`p-1.5 border ${sizeMode === 'qty' ? 'text-accent border-accent/40' : 'text-neutral/30 border-border/20'}`}
                title="Shares">
                <Hash className="w-3 h-3" />
              </button>
              <button type="button" onClick={() => setSizeMode('notional')}
                className={`p-1.5 border ${sizeMode === 'notional' ? 'text-accent border-accent/40' : 'text-neutral/30 border-border/20'}`}
                title="Dollar amount">
                <DollarSign className="w-3 h-3" />
              </button>
              <input
                type="number" step="any" value={qty}
                onChange={(e) => { setQty(e.target.value); setConfirmOrder(false); }}
                placeholder={sizeMode === 'qty' ? t('quantity') : 'USD Amount'}
                className="flex-1 bg-black/60 border border-border/40 px-3 py-2 text-[12px] font-mono text-white placeholder:text-neutral/30"
              />
            </div>

            {/* Quick size buttons */}
            <div className="flex gap-1">
              {[0.25, 0.5, 0.75, 1].map((pct) => (
                <button key={pct} type="button" onClick={() => applyQtyPct(pct)}
                  className="flex-1 py-1 text-[8px] font-bold text-neutral/40 border border-border/20 hover:text-accent hover:border-accent/30 transition-colors">
                  {pct * 100}%
                </button>
              ))}
            </div>

            {/* Limit price */}
            {(orderType === 'limit' || orderType === 'stop_limit') && (
              <input
                type="number" step="any" value={limitPrice}
                onChange={(e) => { setLimitPrice(e.target.value); setConfirmOrder(false); }}
                placeholder={t('limitPriceLabel')}
                className="w-full bg-black/60 border border-border/40 px-3 py-2 text-[12px] font-mono text-white placeholder:text-neutral/30"
              />
            )}

            {/* Stop price */}
            {(orderType === 'stop' || orderType === 'stop_limit') && (
              <input
                type="number" step="any" value={stopPrice}
                onChange={(e) => { setStopPrice(e.target.value); setConfirmOrder(false); }}
                placeholder={t('stopLoss')}
                className="w-full bg-black/60 border border-border/40 px-3 py-2 text-[12px] font-mono text-white placeholder:text-neutral/30"
              />
            )}

            {/* Submit / Confirm */}
            {confirmOrder ? (
              <div className="flex gap-1">
                <button type="submit" disabled={orderLoading}
                  className={`flex-1 py-2.5 text-[11px] font-black uppercase tracking-widest border ${
                    side === 'buy'
                      ? 'bg-bullish/30 text-bullish border-bullish animate-pulse'
                      : 'bg-bearish/30 text-bearish border-bearish animate-pulse'
                  }`}>
                  {orderLoading ? t('submitting') : t('confirm')}
                </button>
                <button type="button" onClick={() => setConfirmOrder(false)}
                  className="px-3 py-2.5 text-[11px] font-black uppercase tracking-widest border border-border/30 text-neutral hover:text-white">
                  ✕
                </button>
              </div>
            ) : (
              <button type="submit" disabled={orderLoading || !qty || !symbol}
                className={`py-2.5 text-[11px] font-black uppercase tracking-widest border ${
                  side === 'buy'
                    ? 'bg-bullish/20 text-bullish border-bullish disabled:opacity-30'
                    : 'bg-bearish/20 text-bearish border-bearish disabled:opacity-30'
                }`}>
                {orderLoading ? t('submitting') : `${t(side)} ${symbol}`}
              </button>
            )}

            {orderResult && (
              <p className={`text-[10px] font-mono ${orderResult.startsWith('Error') ? 'text-bearish' : 'text-bullish'}`}>{orderResult}</p>
            )}
          </form>
        )}

        {/* Positions Tab */}
        {activeTab === 'positions' && (
          <div className="flex flex-col">
            {/* Portfolio summary */}
            {positions.length > 0 && (
              <div className="px-3 py-2 border-b border-border/30 bg-black/20 flex items-center justify-between">
                <span className="text-[9px] font-mono text-neutral uppercase">{positions.length} {t('positions')}</span>
                <span className={`text-[10px] font-mono font-bold ${totalUnrealizedPl >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                  {t('unrealizedPl')}: {totalUnrealizedPl >= 0 ? '+' : ''}${fmtUsd(totalUnrealizedPl)}
                </span>
              </div>
            )}
            {positions.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <span className="text-[10px] font-mono text-neutral uppercase">{t('noOpenPositions')}</span>
              </div>
            ) : (
              positions.map((pos) => {
                const pl = parseFloat(pos.unrealized_pl);
                const plPct = parseFloat(pos.unrealized_plpc) * 100;
                const mktVal = parseFloat(pos.market_value);
                const curPrice = parseFloat(pos.current_price);
                return (
                  <div key={pos.asset_id} className="px-3 py-2 border-b border-border/30 hover:bg-white/[0.02] group">
                    <div className="flex items-center justify-between">
                      <button onClick={() => handlePositionClick(pos)} className="text-left">
                        <span className="text-[11px] font-mono font-bold text-white hover:text-accent transition-colors">{pos.symbol}</span>
                        <span className="text-[9px] font-mono text-neutral ml-2">
                          {pos.qty} @ ${fmtUsd(parseFloat(pos.avg_entry_price))}
                        </span>
                      </button>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <span className="text-[10px] font-mono text-white/70">${fmtUsd(curPrice)}</span>
                          <span className={`text-[10px] font-mono font-bold ml-2 ${pl >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                            {pl >= 0 ? '+' : ''}{fmtUsd(pl)}
                          </span>
                          <span className={`text-[8px] font-mono ml-1 ${pl >= 0 ? 'text-bullish/60' : 'text-bearish/60'}`}>
                            ({plPct >= 0 ? '+' : ''}{plPct.toFixed(2)}%)
                          </span>
                        </div>
                        <button
                          onClick={() => handleClosePosition(pos)}
                          className="opacity-0 group-hover:opacity-100 text-[8px] font-black uppercase tracking-widest px-2 py-1 border border-bearish/40 text-bearish hover:bg-bearish/20 transition-all"
                        >
                          {t('closePosition')}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[8px] font-mono text-neutral/40">
                        MKT ${fmtUsd(mktVal)}
                      </span>
                      <span className="text-[8px] font-mono text-neutral/40">
                        Cost ${fmtUsd(parseFloat(pos.cost_basis))}
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
            {/* Filter bar */}
            <div className="flex gap-1 px-3 py-2 border-b border-border/30 bg-black/20">
              {(['all', 'open', 'closed'] as const).map((f) => (
                <button key={f} onClick={() => setOrderFilter(f)}
                  className={`px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest border ${
                    orderFilter === f ? 'text-accent border-accent bg-accent/5' : 'text-neutral/40 border-border/20'
                  }`}>
                  {f}
                </button>
              ))}
            </div>
            {orders.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <span className="text-[10px] font-mono text-neutral uppercase">{t('noRecentOrders')}</span>
              </div>
            ) : (
              orders.map((ord) => {
                const isOpen = ['new', 'accepted', 'pending_new', 'partially_filled'].includes(ord.status);
                return (
                  <div key={ord.id} className="px-3 py-2 border-b border-border/30 hover:bg-white/[0.02] group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 border ${
                          ord.side === 'buy' ? 'text-bullish border-bullish/30 bg-bullish/10' : 'text-bearish border-bearish/30 bg-bearish/10'
                        }`}>{ord.side}</span>
                        <span className="text-[11px] font-mono font-bold text-white">{ord.symbol}</span>
                        <span className="text-[9px] font-mono text-neutral">
                          {ord.qty || `$${ord.notional}`} × {ord.type.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-mono font-bold uppercase ${
                          ord.status === 'filled' ? 'text-bullish' : ord.status === 'canceled' ? 'text-neutral/40' : 'text-accent'
                        }`}>{ord.status.replace('_', ' ')}</span>
                        {isOpen && (
                          <button
                            onClick={() => handleCancelOrder(ord.id)}
                            className="opacity-0 group-hover:opacity-100 text-[8px] font-black uppercase px-1.5 py-0.5 border border-bearish/40 text-bearish hover:bg-bearish/20 transition-all"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {ord.filled_avg_price && (
                        <span className="text-[8px] font-mono text-neutral/50">
                          Fill ${fmtUsd(parseFloat(ord.filled_avg_price))}
                        </span>
                      )}
                      {ord.limit_price && (
                        <span className="text-[8px] font-mono text-neutral/50">
                          Lmt ${fmtUsd(parseFloat(ord.limit_price))}
                        </span>
                      )}
                      {ord.stop_price && (
                        <span className="text-[8px] font-mono text-neutral/50">
                          Stp ${fmtUsd(parseFloat(ord.stop_price))}
                        </span>
                      )}
                      <span className="text-[8px] font-mono text-neutral/40 uppercase">{ord.time_in_force}</span>
                      {ord.filled_qty && ord.filled_qty !== '0' && ord.filled_qty !== ord.qty && (
                        <span className="text-[8px] font-mono text-amber-400/60">
                          {ord.filled_qty}/{ord.qty} filled
                        </span>
                      )}
                      <span className="text-[8px] font-mono text-neutral/30 ml-auto">
                        {new Date(ord.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function fmtUsd(n: number): string {
  if (isNaN(n)) return '0.00';
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (Math.abs(n) >= 1_000) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n.toFixed(2);
}
