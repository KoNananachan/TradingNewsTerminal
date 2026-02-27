import { useState, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { useAllMids, useUserState } from '../../hooks/use-hyperliquid';
import { useAppStore } from '../../stores/use-app-store';
import { api } from '../../api/client';
import { Wallet } from 'lucide-react';

interface TradeFormProps {
  coin: string;
}

export function TradeForm({ coin }: TradeFormProps) {
  const { isConnected, address } = useAccount();
  const { data: mids } = useAllMids();
  const { data: userState } = useUserState();
  const addLogEntry = useAppStore((s) => s.addLogEntry);
  const addNotification = useAppStore((s) => s.addNotification);
  const tradingSourceArticleId = useAppStore((s) => s.tradingSourceArticleId);

  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [size, setSize] = useState('');
  const [price, setPrice] = useState('');
  const [leverage, setLeverage] = useState(1);

  const midPrice = mids?.[coin] ? parseFloat(mids[coin]) : null;

  // Available balance from Hyperliquid account
  const availableUsd = useMemo(() => {
    if (!userState) return null;
    return parseFloat(userState.withdrawable);
  }, [userState]);

  // Max size user can open at current price & leverage
  const maxSize = useMemo(() => {
    if (availableUsd == null || !midPrice || midPrice <= 0) return null;
    const effectivePrice = orderType === 'limit' && price ? parseFloat(price) : midPrice;
    if (!effectivePrice || effectivePrice <= 0) return null;
    return (availableUsd * leverage) / effectivePrice;
  }, [availableUsd, midPrice, leverage, orderType, price]);

  const setSizePercent = (pct: number) => {
    if (maxSize == null) return;
    const val = maxSize * pct;
    // Smart rounding based on price
    setSize(val >= 1 ? val.toFixed(4) : val.toPrecision(4));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !size) return;

    // Log trade intent (actual signing would require Hyperliquid EIP-712 integration)
    const sizeVal = parseFloat(size);
    const priceVal = orderType === 'limit' ? parseFloat(price) : midPrice;

    const orderDesc = `${side.toUpperCase()} ${sizeVal} ${coin} @ ${orderType === 'market' ? 'MKT' : '$' + priceVal?.toFixed(2)} (${leverage}x)`;

    addLogEntry({ type: 'trade', message: orderDesc });
    addLogEntry({ type: 'alert', message: `Order signing requires Hyperliquid wallet integration — demo mode` });

    addNotification({
      id: Date.now(),
      title: `Order Submitted: ${orderDesc}`,
      sentiment: null,
      symbols: [coin],
      time: new Date(),
    });

    // Fire-and-forget audit log
    if (address) {
      const notional = sizeVal * (priceVal || 0);
      api.post('/audit/trade', {
        walletAddress: address,
        coin,
        side,
        orderType,
        size: sizeVal,
        price: priceVal ?? undefined,
        leverage,
        midPrice: midPrice ?? undefined,
        notionalValue: notional || undefined,
        marginRequired: notional ? notional / leverage : undefined,
        status: 'demo',
        sourceArticleId: tradingSourceArticleId ?? undefined,
      }).catch(() => {});
    }

    setSize('');
    setPrice('');
  };

  const leverageOptions = [1, 2, 3, 5, 10, 20, 50];

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 p-3">
      {/* Side toggle */}
      <div className="grid grid-cols-2 gap-1">
        <button
          type="button"
          onClick={() => setSide('buy')}
          className={`py-2 text-[11px] font-black uppercase tracking-widest border ${
            side === 'buy'
              ? 'bg-bullish/20 text-bullish border-bullish'
              : 'bg-black text-neutral/50 border-border/30 hover:border-border'
          }`}
        >
          Long
        </button>
        <button
          type="button"
          onClick={() => setSide('sell')}
          className={`py-2 text-[11px] font-black uppercase tracking-widest border ${
            side === 'sell'
              ? 'bg-bearish/20 text-bearish border-bearish'
              : 'bg-black text-neutral/50 border-border/30 hover:border-border'
          }`}
        >
          Short
        </button>
      </div>

      {/* Order type */}
      <div className="flex gap-2">
        {(['market', 'limit'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setOrderType(t)}
            className={`flex-1 py-1 text-[9px] font-bold uppercase tracking-widest border ${
              orderType === t
                ? 'text-accent border-accent bg-accent/5'
                : 'text-neutral/40 border-border/20 hover:text-neutral'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Price input (limit only) */}
      {orderType === 'limit' && (
        <div>
          <label className="text-[8px] font-black uppercase tracking-[0.15em] text-neutral/50 mb-1 block">
            Price (USD)
          </label>
          <input
            type="number"
            step="any"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder={midPrice?.toFixed(2) ?? '0.00'}
            className="w-full bg-black/60 border border-border/40 px-3 py-2 text-[12px] font-mono text-white placeholder:text-neutral/30"
          />
        </div>
      )}

      {/* Balance display */}
      {isConnected && (
        <div className="flex items-center justify-between px-1 py-1.5 border border-border/20 bg-black/40 rounded">
          <div className="flex items-center gap-1.5">
            <Wallet className="w-3 h-3 text-accent/60" />
            <span className="text-[8px] font-black uppercase tracking-[0.1em] text-neutral/50">Available</span>
          </div>
          <span className="text-[11px] font-mono font-bold text-white">
            {availableUsd != null ? `$${fmtUsd(availableUsd)}` : '—'}
            <span className="text-[8px] text-neutral/40 ml-1">USDC</span>
          </span>
        </div>
      )}

      {/* Size input */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[8px] font-black uppercase tracking-[0.15em] text-neutral/50">
            Size ({coin})
          </label>
          {maxSize != null && midPrice && (
            <span className="text-[8px] font-mono text-neutral/40">
              Max: {maxSize >= 1 ? maxSize.toFixed(4) : maxSize.toPrecision(4)}
            </span>
          )}
        </div>
        <input
          type="number"
          step="any"
          value={size}
          onChange={(e) => setSize(e.target.value)}
          placeholder="0.00"
          className="w-full bg-black/60 border border-border/40 px-3 py-2 text-[12px] font-mono text-white placeholder:text-neutral/30"
        />
        {/* Quick percent buttons */}
        {isConnected && maxSize != null && (
          <div className="flex gap-1 mt-1">
            {[0.25, 0.5, 0.75, 1].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => setSizePercent(pct)}
                className="flex-1 py-0.5 text-[8px] font-bold font-mono text-neutral/50 border border-border/20 hover:text-accent hover:border-accent/30 bg-black/30 transition-colors"
              >
                {pct * 100}%
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Leverage */}
      <div>
        <label className="text-[8px] font-black uppercase tracking-[0.15em] text-neutral/50 mb-1 block">
          Leverage
        </label>
        <div className="flex gap-1">
          {leverageOptions.map((lev) => (
            <button
              key={lev}
              type="button"
              onClick={() => setLeverage(lev)}
              className={`flex-1 py-1 text-[9px] font-bold font-mono border ${
                leverage === lev
                  ? 'text-accent border-accent bg-accent/5'
                  : 'text-neutral/40 border-border/20 hover:text-neutral'
              }`}
            >
              {lev}x
            </button>
          ))}
        </div>
      </div>

      {/* Order summary */}
      {midPrice && size && (
        <div className="flex flex-col gap-1 px-1 text-[9px] font-mono text-neutral/50">
          <div className="flex justify-between">
            <span>Notional Value:</span>
            <span className="text-white font-bold">
              ${fmtUsd(parseFloat(size || '0') * (orderType === 'limit' ? parseFloat(price || '0') : midPrice))}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Margin Required:</span>
            <span className="text-accent font-bold">
              ${fmtUsd(parseFloat(size || '0') * (orderType === 'limit' ? parseFloat(price || '0') : midPrice) / leverage)}
            </span>
          </div>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={!isConnected || !size}
        className={`py-2.5 text-[11px] font-black uppercase tracking-widest border ${
          side === 'buy'
            ? 'bg-bullish/20 text-bullish border-bullish hover:bg-bullish/30 disabled:bg-bullish/5 disabled:text-bullish/30 disabled:border-bullish/20'
            : 'bg-bearish/20 text-bearish border-bearish hover:bg-bearish/30 disabled:bg-bearish/5 disabled:text-bearish/30 disabled:border-bearish/20'
        }`}
      >
        {!isConnected
          ? 'Connect Wallet'
          : `${side === 'buy' ? 'Long' : 'Short'} ${coin}`}
      </button>
    </form>
  );
}

function fmtUsd(n: number): string {
  if (isNaN(n)) return '0.00';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n.toFixed(2);
}
