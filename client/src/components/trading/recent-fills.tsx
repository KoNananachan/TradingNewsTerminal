import { useState, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { useUserFills, useOpenOrders, usePerpMetaAndCtxs, useStockPerps } from '../../hooks/use-hyperliquid';
import { useQueryClient } from '@tanstack/react-query';
import { signL1Action, getAgentWallet } from '../../lib/hyperliquid/agent-wallet';
import { getDexOffsets, getDexPrefix } from '../../lib/hyperliquid/signing';
import { X, Loader2 } from 'lucide-react';
import { useT } from '../../i18n';

const HL_EXCHANGE_URL = 'https://api.hyperliquid.xyz/exchange';

/** Strip dex prefix: "xyz:NVDA" → "NVDA" */
function displayCoin(coin: string): string {
  if (!coin.includes(':')) return coin;
  const parts = coin.split(':');
  return parts[parts.length - 1] || coin;
}

export function RecentFills() {
  const t = useT();
  const { isConnected, address } = useAccount();
  const { data: fills } = useUserFills();
  const { data: openOrders } = useOpenOrders();
  const { data: perpMeta } = usePerpMetaAndCtxs();
  const { data: stockMeta } = useStockPerps();
  const queryClient = useQueryClient();
  const [cancellingOid, setCancellingOid] = useState<number | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  /** Resolve the global asset index for a coin. */
  const resolveAssetIndex = useCallback(async (coin: string): Promise<number> => {
    // Regular perps
    if (perpMeta) {
      const idx = perpMeta[0].universe.findIndex((a) => a.name === coin);
      if (idx >= 0) return idx;
    }
    // Builder dex perps (xyz, etc.)
    if (stockMeta) {
      const idx = stockMeta[0].universe.findIndex((a) => a.name === coin);
      if (idx >= 0) {
        const dexName = getDexPrefix(coin);
        const offsets = await getDexOffsets();
        return (offsets[dexName] ?? 0) + idx;
      }
    }
    return -1;
  }, [perpMeta, stockMeta]);

  const handleCancel = useCallback(async (coin: string, oid: number) => {
    if (!address) return;
    const agent = getAgentWallet(address);
    if (!agent) return;

    setCancellingOid(oid);
    setCancelError(null);
    try {
      const assetIndex = await resolveAssetIndex(coin);
      if (assetIndex < 0) {
        setCancelError(`Cannot resolve asset index for ${displayCoin(coin)}`);
        return;
      }

      const action = {
        type: 'cancel',
        cancels: [{ a: assetIndex, o: oid }],
      };

      const nonce = Date.now();
      const sig = await signL1Action(
        agent.privateKey,
        action as Record<string, unknown>,
        nonce,
      );

      const res = await fetch(HL_EXCHANGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          nonce,
          signature: sig,
          vaultAddress: null,
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.status === 'ok') {
        queryClient.invalidateQueries({ queryKey: ['hl', 'openOrders'] });
        queryClient.invalidateQueries({ queryKey: ['hl', 'userState'] });
        queryClient.invalidateQueries({ queryKey: ['hl', 'stockUserState'] });
        queryClient.invalidateQueries({ queryKey: ['hl', 'spotBalances'] });
      } else {
        const errMsg = data.response?.payload || data.response || t('cancelFailed');
        setCancelError(String(errMsg));
      }
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : t('cancelFailed'));
    } finally {
      setCancellingOid(null);
    }
  }, [address, queryClient, resolveAssetIndex, t]);

  if (!isConnected) return null;

  const orders = openOrders ?? [];
  const recentFills = (fills ?? []).slice(0, 20);

  return (
    <div className="overflow-auto flex-1">
      {/* Cancel error banner */}
      {cancelError && (
        <div className="px-3 py-1.5 bg-bearish/10 border-b border-bearish/30 text-[9px] font-mono text-bearish">
          {cancelError}
        </div>
      )}
      {/* Open Orders */}
      {orders.length > 0 && (
        <div>
          <div className="px-3 py-1.5 bg-black/60 border-b border-border/20">
            <span className="text-[9px] font-black uppercase tracking-[0.15em] text-accent">
              {t('openOrders')} ({orders.length})
            </span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-[8px] text-neutral/50 uppercase tracking-[0.15em]">
                <th className="text-left px-3 py-1.5 font-black">{t('asset')}</th>
                <th className="text-left px-3 py-1.5 font-black">{t('side')}</th>
                <th className="text-right px-3 py-1.5 font-black">{t('price')}</th>
                <th className="text-right px-3 py-1.5 font-black">{t('size')}</th>
                <th className="text-right px-3 py-1.5 font-black"></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const isBuy = order.side === 'B';
                return (
                  <tr key={order.oid} className="hover:bg-accent/[0.03] border-b border-border/5">
                    <td className="px-3 py-1.5 font-mono font-bold text-white text-[10px]">
                      {displayCoin(order.coin)}
                    </td>
                    <td className="px-3 py-1.5">
                      <span className={`text-[9px] font-black px-1 border ${isBuy ? 'text-bullish border-bullish/30' : 'text-bearish border-bearish/30'}`}>
                        {isBuy ? t('buyLabel') : t('sellLabel')}
                      </span>
                    </td>
                    <td className="text-right px-3 py-1.5 font-mono text-[10px] text-gray-300">
                      ${parseFloat(order.limitPx).toFixed(2)}
                    </td>
                    <td className="text-right px-3 py-1.5 font-mono text-[10px] text-gray-300">
                      {parseFloat(order.sz).toString()}
                    </td>
                    <td className="text-right px-2 py-1.5">
                      <button
                        onClick={() => handleCancel(order.coin, order.oid)}
                        disabled={cancellingOid === order.oid}
                        className="text-bearish/70 hover:text-bearish p-0.5 transition-colors disabled:opacity-30"
                        title="Cancel order"
                      >
                        {cancellingOid === order.oid
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <X className="w-3 h-3" />
                        }
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Recent Fills */}
      <div>
        <div className="px-3 py-1.5 bg-black/60 border-b border-border/20">
          <span className="text-[9px] font-black uppercase tracking-[0.15em] text-accent">
            {t('recentFills')} ({recentFills.length})
          </span>
        </div>
        {recentFills.length === 0 ? (
          <div className="text-center py-4 text-neutral/40 text-[9px] font-mono uppercase tracking-widest">
            {t('noRecentFills')}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-[8px] text-neutral/50 uppercase tracking-[0.15em]">
                <th className="text-left px-3 py-1.5 font-black">{t('time')}</th>
                <th className="text-left px-3 py-1.5 font-black">{t('asset')}</th>
                <th className="text-left px-3 py-1.5 font-black">{t('side')}</th>
                <th className="text-right px-3 py-1.5 font-black">{t('price')}</th>
                <th className="text-right px-3 py-1.5 font-black">{t('size')}</th>
                <th className="text-right px-3 py-1.5 font-black">{t('pnl')}</th>
              </tr>
            </thead>
            <tbody>
              {recentFills.map((fill) => {
                const isBuy = fill.side === 'B';
                const pnl = parseFloat(fill.closedPnl);
                return (
                  <tr key={fill.tid} className="hover:bg-accent/[0.03] border-b border-border/5">
                    <td className="px-3 py-1.5 text-[9px] font-mono text-neutral/60">
                      {new Date(fill.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="px-3 py-1.5 font-mono font-bold text-white text-[10px]">
                      {displayCoin(fill.coin)}
                    </td>
                    <td className="px-3 py-1.5">
                      <span className={`text-[9px] font-black px-1 border ${isBuy ? 'text-bullish border-bullish/30' : 'text-bearish border-bearish/30'}`}>
                        {isBuy ? t('buyLabel') : t('sellLabel')}
                      </span>
                    </td>
                    <td className="text-right px-3 py-1.5 font-mono text-[10px] text-gray-300">
                      ${parseFloat(fill.px).toFixed(2)}
                    </td>
                    <td className="text-right px-3 py-1.5 font-mono text-[10px] text-gray-300">
                      {parseFloat(fill.sz).toString()}
                    </td>
                    <td className={`text-right px-3 py-1.5 font-mono text-[10px] font-bold ${
                      pnl > 0 ? 'text-bullish' : pnl < 0 ? 'text-bearish' : 'text-neutral/40'
                    }`}>
                      {pnl !== 0 ? `${pnl > 0 ? '+' : ''}$${pnl.toFixed(2)}` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
