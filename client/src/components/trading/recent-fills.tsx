import { useState, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { useUserFills, useOpenOrders } from '../../hooks/use-hyperliquid';
import { useQueryClient } from '@tanstack/react-query';
import { signL1Action, getAgentWallet } from '../../lib/hyperliquid/agent-wallet';
import { X, Loader2 } from 'lucide-react';

const HL_EXCHANGE_URL = 'https://api.hyperliquid.xyz/exchange';

/** Strip dex prefix: "xyz:NVDA" → "NVDA" */
function displayCoin(coin: string): string {
  return coin.includes(':') ? coin.split(':').pop()! : coin;
}

export function RecentFills() {
  const { isConnected, address } = useAccount();
  const { data: fills } = useUserFills();
  const { data: openOrders } = useOpenOrders();
  const queryClient = useQueryClient();
  const [cancellingOid, setCancellingOid] = useState<number | null>(null);

  const handleCancel = useCallback(async (coin: string, oid: number) => {
    if (!address) return;
    const agent = getAgentWallet(address);
    if (!agent) return;

    setCancellingOid(oid);
    try {
      const action = {
        type: 'cancel',
        cancels: [{ a: 0, o: oid }],
      };

      // We need the asset index, but we can use the oid-based cancel
      // Hyperliquid also supports cancelByCloid, but oid cancel is simpler
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
      });

      const data = await res.json();
      console.log('[Cancel] Response:', JSON.stringify(data));

      if (data.status === 'ok') {
        queryClient.invalidateQueries({ queryKey: ['hl', 'openOrders'] });
        queryClient.invalidateQueries({ queryKey: ['hl', 'userState'] });
        queryClient.invalidateQueries({ queryKey: ['hl', 'stockUserState'] });
        queryClient.invalidateQueries({ queryKey: ['hl', 'spotBalances'] });
      }
    } catch (err) {
      console.error('[Cancel] Error:', err);
    } finally {
      setCancellingOid(null);
    }
  }, [address, queryClient]);

  if (!isConnected) return null;

  const orders = openOrders ?? [];
  const recentFills = (fills ?? []).slice(0, 20);

  return (
    <div className="overflow-auto flex-1">
      {/* Open Orders */}
      {orders.length > 0 && (
        <div>
          <div className="px-3 py-1.5 bg-black/60 border-b border-border/20">
            <span className="text-[9px] font-black uppercase tracking-[0.15em] text-accent">
              Open Orders ({orders.length})
            </span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-[8px] text-neutral/50 uppercase tracking-[0.15em]">
                <th className="text-left px-3 py-1.5 font-black">Asset</th>
                <th className="text-left px-3 py-1.5 font-black">Side</th>
                <th className="text-right px-3 py-1.5 font-black">Price</th>
                <th className="text-right px-3 py-1.5 font-black">Size</th>
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
                        {isBuy ? 'BUY' : 'SELL'}
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
            Recent Fills ({recentFills.length})
          </span>
        </div>
        {recentFills.length === 0 ? (
          <div className="text-center py-4 text-neutral/40 text-[9px] font-mono uppercase tracking-widest">
            No recent fills
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-[8px] text-neutral/50 uppercase tracking-[0.15em]">
                <th className="text-left px-3 py-1.5 font-black">Time</th>
                <th className="text-left px-3 py-1.5 font-black">Asset</th>
                <th className="text-left px-3 py-1.5 font-black">Side</th>
                <th className="text-right px-3 py-1.5 font-black">Price</th>
                <th className="text-right px-3 py-1.5 font-black">Size</th>
                <th className="text-right px-3 py-1.5 font-black">PnL</th>
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
                        {isBuy ? 'BUY' : 'SELL'}
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
