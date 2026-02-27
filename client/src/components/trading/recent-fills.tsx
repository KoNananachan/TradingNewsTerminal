import { useAccount } from 'wagmi';
import { useUserFills } from '../../hooks/use-hyperliquid';

export function RecentFills() {
  const { isConnected } = useAccount();
  const { data: fills } = useUserFills();

  if (!isConnected) return null;

  const recentFills = (fills ?? []).slice(0, 20);

  if (recentFills.length === 0) {
    return (
      <div className="text-center py-4 text-neutral/40 text-[9px] font-mono uppercase tracking-widest">
        No recent fills
      </div>
    );
  }

  return (
    <div className="overflow-auto flex-1">
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
                  {fill.coin}
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
                  {parseFloat(fill.sz).toFixed(4)}
                </td>
                <td className={`text-right px-3 py-1.5 font-mono text-[10px] font-bold ${
                  pnl > 0 ? 'text-bullish' : pnl < 0 ? 'text-bearish' : 'text-neutral/40'
                }`}>
                  {pnl !== 0 ? `${pnl > 0 ? '+' : ''}${pnl.toFixed(2)}` : '-'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
