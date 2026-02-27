import { useAccount } from 'wagmi';
import { useUserState, useSpotBalances } from '../../hooks/use-hyperliquid';
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react';

export function PortfolioView() {
  const { isConnected } = useAccount();
  const { data: userState, isLoading: loadingPerps } = useUserState();
  const { data: spotState, isLoading: loadingSpot } = useSpotBalances();

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-3">
        <Wallet className="w-6 h-6 text-neutral/40" />
        <span className="text-[10px] font-mono text-neutral/50 uppercase tracking-widest">
          Connect wallet to view portfolio
        </span>
      </div>
    );
  }

  if (loadingPerps || loadingSpot) {
    return (
      <div className="flex items-center justify-center py-8">
        <span className="text-[10px] font-mono text-accent animate-pulse uppercase">
          Loading portfolio...
        </span>
      </div>
    );
  }

  const margin = userState?.crossMarginSummary;
  const positions = userState?.assetPositions?.filter(
    (p) => parseFloat(p.position.szi) !== 0,
  ) ?? [];

  const spotBalances = spotState?.balances?.filter(
    (b) => parseFloat(b.total) > 0,
  ) ?? [];

  return (
    <div className="flex flex-col gap-1">
      {/* Account Summary */}
      {margin && (
        <div className="grid grid-cols-3 border-b border-border/30 bg-black/40">
          <SummaryCell label="Account Value" value={`$${fmtNum(margin.accountValue)}`} />
          <SummaryCell label="Margin Used" value={`$${fmtNum(margin.totalMarginUsed)}`} />
          <SummaryCell label="Withdrawable" value={`$${fmtNum(userState?.withdrawable ?? '0')}`} />
        </div>
      )}

      {/* Perp Positions */}
      {positions.length > 0 && (
        <div>
          <div className="px-3 py-1.5 bg-black/60 border-b border-border/20">
            <span className="text-[9px] font-black uppercase tracking-[0.15em] text-accent">
              Perpetual Positions ({positions.length})
            </span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-[8px] text-neutral/50 uppercase tracking-[0.15em]">
                <th className="text-left px-3 py-1.5 font-black">Asset</th>
                <th className="text-right px-3 py-1.5 font-black">Size</th>
                <th className="text-right px-3 py-1.5 font-black">Entry</th>
                <th className="text-right px-3 py-1.5 font-black">PnL</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => {
                const pos = p.position;
                const size = parseFloat(pos.szi);
                const pnl = parseFloat(pos.unrealizedPnl);
                const isLong = size > 0;
                return (
                  <tr key={pos.coin} className="hover:bg-accent/[0.03] border-b border-border/5">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[9px] font-black px-1 border ${isLong ? 'text-bullish border-bullish/30' : 'text-bearish border-bearish/30'}`}>
                          {isLong ? 'LONG' : 'SHORT'}
                        </span>
                        <span className="font-mono font-bold text-white text-[11px]">
                          {pos.coin}
                        </span>
                      </div>
                    </td>
                    <td className="text-right px-3 py-2 font-mono text-[11px] text-gray-300">
                      {Math.abs(size).toFixed(4)}
                    </td>
                    <td className="text-right px-3 py-2 font-mono text-[11px] text-gray-300">
                      ${fmtNum(pos.entryPx ?? '0')}
                    </td>
                    <td className={`text-right px-3 py-2 font-mono text-[11px] font-bold ${pnl >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                      {pnl >= 0 ? '+' : ''}{fmtNum(pos.unrealizedPnl)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Spot Balances */}
      {spotBalances.length > 0 && (
        <div>
          <div className="px-3 py-1.5 bg-black/60 border-b border-border/20">
            <span className="text-[9px] font-black uppercase tracking-[0.15em] text-accent">
              Spot Balances ({spotBalances.length})
            </span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-[8px] text-neutral/50 uppercase tracking-[0.15em]">
                <th className="text-left px-3 py-1.5 font-black">Token</th>
                <th className="text-right px-3 py-1.5 font-black">Total</th>
                <th className="text-right px-3 py-1.5 font-black">Available</th>
              </tr>
            </thead>
            <tbody>
              {spotBalances.map((b) => (
                <tr key={b.coin} className="hover:bg-accent/[0.03] border-b border-border/5">
                  <td className="px-3 py-2 font-mono font-bold text-white text-[11px]">{b.coin}</td>
                  <td className="text-right px-3 py-2 font-mono text-[11px] text-gray-300">
                    {fmtNum(b.total)}
                  </td>
                  <td className="text-right px-3 py-2 font-mono text-[11px] text-gray-300">
                    {fmtNum(String(parseFloat(b.total) - parseFloat(b.hold)))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {positions.length === 0 && spotBalances.length === 0 && margin && (
        <div className="text-center py-6 text-neutral/40 text-[10px] font-mono uppercase tracking-widest">
          No open positions
        </div>
      )}
    </div>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-2 border-r border-border/20 last:border-r-0 text-center">
      <div className="text-[8px] font-black uppercase tracking-[0.15em] text-neutral/50">{label}</div>
      <div className="text-[12px] font-mono font-bold text-white mt-0.5">{value}</div>
    </div>
  );
}

function fmtNum(val: string): string {
  const n = parseFloat(val);
  if (isNaN(n)) return val;
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (Math.abs(n) >= 1_000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (Math.abs(n) >= 1) return n.toFixed(2);
  return n.toFixed(4);
}
