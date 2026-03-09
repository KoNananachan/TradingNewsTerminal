import { useState, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { useUserState, useStockUserState, useSpotBalances, usePerpMetaAndCtxs, useStockPerps, useCombinedMids } from '../../hooks/use-hyperliquid';
import { useQueryClient } from '@tanstack/react-query';
import { Wallet, Loader2, X } from 'lucide-react';
import {
  buildOrderAction,
  formatPrice,
  formatSize,
  applySlippage,
  getDexOffsets,
  getDexPrefix,
  type OrderWire,
} from '../../lib/hyperliquid/signing';
import { signL1Action, getAgentWallet, removeAgentWallet } from '../../lib/hyperliquid/agent-wallet';

const HL_EXCHANGE_URL = 'https://api.hyperliquid.xyz/exchange';

/** Strip dex prefix for display: "xyz:NVDA" → "NVDA" */
function displayCoin(coin: string): string {
  if (!coin.includes(':')) return coin;
  const parts = coin.split(':');
  return parts[parts.length - 1] || coin;
}

export function PortfolioView() {
  const { isConnected, address } = useAccount();
  const { data: userState, isLoading: loadingPerps } = useUserState();
  const { data: stockState, isLoading: loadingStock } = useStockUserState();
  const { data: spotState, isLoading: loadingSpot } = useSpotBalances();
  const { data: perpData } = usePerpMetaAndCtxs();
  const { data: stockPerps } = useStockPerps();
  const { data: mids } = useCombinedMids();
  const queryClient = useQueryClient();
  const [closingCoin, setClosingCoin] = useState<string | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);

  const handleClose = useCallback(async (coin: string, szi: string) => {
    if (!address) return;
    if (closingCoin) return; // Prevent concurrent close requests
    const agent = getAgentWallet(address);
    if (!agent) { setCloseError('No trading key. Set up in TRADE tab first.'); return; }

    setClosingCoin(coin);
    setCloseError(null);
    try {
      const size = parseFloat(szi);
      const isLong = size > 0;
      const absSize = Math.abs(size);

      // Resolve asset index
      const dexPrefix = getDexPrefix(coin);
      const baseCoin = displayCoin(coin);
      let assetIndex = -1;
      let szDecimals = 2;

      if (dexPrefix === 'xyz' && stockPerps) {
        const [meta] = stockPerps;
        const idx = meta.universe.findIndex((a) => a.name === coin);
        if (idx >= 0) {
          const offsets = await getDexOffsets();
          assetIndex = (offsets['xyz'] ?? 110000) + idx;
          szDecimals = meta.universe[idx].szDecimals;
        }
      } else if (perpData) {
        const [meta] = perpData;
        const idx = meta.universe.findIndex((a) => a.name === coin);
        if (idx >= 0) {
          assetIndex = idx;
          szDecimals = meta.universe[idx].szDecimals;
        }
      }

      if (assetIndex < 0) {
        setCloseError(`Could not resolve asset index for ${displayCoin(coin)}`);
        return;
      }

      // Get mid price for market order
      const midStr = mids?.[coin] ?? mids?.[baseCoin];
      const midPrice = midStr ? parseFloat(midStr) : 0;
      if (!midPrice || !Number.isFinite(midPrice)) {
        setCloseError(`No mid price available for ${displayCoin(coin)}`);
        return;
      }

      // Close = opposite side market order with reduce_only
      const isBuy = !isLong; // close long = sell, close short = buy
      const orderPrice = applySlippage(midPrice, isBuy);

      const orderWire: OrderWire = {
        a: assetIndex,
        b: isBuy,
        p: formatPrice(orderPrice),
        s: formatSize(absSize, szDecimals),
        r: true, // reduce_only
        t: { limit: { tif: 'Ioc' } },
      };

      const action = buildOrderAction([orderWire]);
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
        queryClient.invalidateQueries({ queryKey: ['hl', 'userState'] });
        queryClient.invalidateQueries({ queryKey: ['hl', 'stockUserState'] });
        queryClient.invalidateQueries({ queryKey: ['hl', 'spotBalances'] });
        queryClient.invalidateQueries({ queryKey: ['hl', 'openOrders'] });
      } else {
        const errMsg = data.response?.payload || data.response || JSON.stringify(data);
        if (String(errMsg).includes('does not exist')) {
          // Agent wallet approval expired — need to re-approve in TRADE tab
          removeAgentWallet(address);
          setCloseError('Trading key expired. Re-setup in TRADE tab.');
        } else {
          setCloseError(String(errMsg));
        }
      }
    } catch (err: unknown) {
      setCloseError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setClosingCoin(null);
    }
  }, [address, perpData, stockPerps, mids, queryClient, closingCoin]);

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

  if (loadingPerps || loadingStock || loadingSpot) {
    return (
      <div className="flex items-center justify-center py-8">
        <span className="text-[10px] font-mono text-accent animate-pulse uppercase">
          Loading portfolio...
        </span>
      </div>
    );
  }

  // Perp margin summaries from regular + stock (xyz) dex
  const regMargin = userState?.crossMarginSummary;
  const stockMargin = stockState?.crossMarginSummary;
  const perpAccountValue =
    parseFloat(regMargin?.accountValue ?? '0') +
    parseFloat(stockMargin?.accountValue ?? '0');
  const totalMarginUsed =
    parseFloat(regMargin?.totalMarginUsed ?? '0') +
    parseFloat(stockMargin?.totalMarginUsed ?? '0');

  // Spot balances — spot.hold is margin locked for xyz dex (already counted in stock.accountValue)
  const spotBalances = spotState?.balances?.filter(
    (b) => parseFloat(b.total) > 0,
  ) ?? [];
  const spotTotal = spotBalances.reduce((sum, b) => sum + parseFloat(b.total), 0);
  const spotHold = spotBalances.reduce((sum, b) => sum + parseFloat(b.hold), 0);
  const spotAvailable = spotTotal - spotHold;

  // Total account value = spot available (excluding held margin) + perp account values
  const totalAccountValue = spotAvailable + perpAccountValue;
  const withdrawable = spotAvailable +
    parseFloat(userState?.withdrawable ?? '0') +
    parseFloat(stockState?.withdrawable ?? '0');

  // Merge positions from regular + stock dex
  const regPositions = userState?.assetPositions?.filter(
    (p) => parseFloat(p.position.szi) !== 0,
  ) ?? [];
  const stockPositions = stockState?.assetPositions?.filter(
    (p) => parseFloat(p.position.szi) !== 0,
  ) ?? [];
  const positions = [...regPositions, ...stockPositions];

  return (
    <div className="flex flex-col gap-1">
      {/* Account Summary */}
      <div className="grid grid-cols-3 border-b border-border/30 bg-black/40">
        <SummaryCell label="Account Value" value={`$${fmtUsd(totalAccountValue)}`} />
        <SummaryCell label="Margin Used" value={`$${fmtUsd(totalMarginUsed)}`} />
        <SummaryCell label="Withdrawable" value={`$${fmtUsd(withdrawable)}`} />
      </div>

      {/* Error banner */}
      {closeError && (
        <div className="px-3 py-1.5 bg-bearish/10 border-b border-bearish/30 text-[9px] font-mono text-bearish">
          {closeError}
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
                <th className="text-right px-3 py-1.5 font-black">Value</th>
                <th className="text-right px-3 py-1.5 font-black">Entry</th>
                <th className="text-right px-3 py-1.5 font-black">uPnL</th>
                <th className="text-right px-3 py-1.5 font-black"></th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => {
                const pos = p.position;
                const size = parseFloat(pos.szi);
                const pnl = parseFloat(pos.unrealizedPnl);
                const isLong = size > 0;
                const leverage = pos.leverage?.value;
                return (
                  <tr key={pos.coin} className="hover:bg-accent/[0.03] border-b border-border/5">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[9px] font-black px-1 border ${isLong ? 'text-bullish border-bullish/30' : 'text-bearish border-bearish/30'}`}>
                          {isLong ? 'LONG' : 'SHORT'}
                        </span>
                        <span className="font-mono font-bold text-white text-[11px]">
                          {displayCoin(pos.coin)}
                        </span>
                        {leverage != null && (
                          <span className="text-[8px] text-neutral/40">{leverage}x</span>
                        )}
                      </div>
                    </td>
                    <td className="text-right px-3 py-2 font-mono text-[11px] text-gray-300">
                      {stripTrailingZeros(Math.abs(size))}
                    </td>
                    <td className="text-right px-3 py-2 font-mono text-[11px] text-white font-bold">
                      ${fmtUsd(parseFloat(pos.positionValue))}
                    </td>
                    <td className="text-right px-3 py-2 font-mono text-[11px] text-gray-300">
                      ${fmtUsd(parseFloat(pos.entryPx ?? '0'))}
                    </td>
                    <td className={`text-right px-3 py-2 font-mono text-[11px] font-bold ${pnl >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                      {pnl >= 0 ? '+' : ''}${fmtUsd(pnl)}
                    </td>
                    <td className="text-right px-2 py-2">
                      <button
                        onClick={() => handleClose(pos.coin, pos.szi)}
                        disabled={closingCoin === pos.coin}
                        className="text-[8px] font-black uppercase px-1.5 py-0.5 border border-bearish/40 text-bearish/80 hover:bg-bearish/10 hover:text-bearish transition-colors disabled:opacity-30"
                        title="Close position at market"
                      >
                        {closingCoin === pos.coin
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : 'Close'
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
                    {fmtUsd(parseFloat(b.total))}
                  </td>
                  <td className="text-right px-3 py-2 font-mono text-[11px] text-gray-300">
                    {fmtUsd(parseFloat(b.total) - parseFloat(b.hold))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {positions.length === 0 && spotBalances.length === 0 && (
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

/** Format a number as USD with appropriate precision */
function fmtUsd(n: number): string {
  if (isNaN(n)) return '0.00';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (abs >= 1_000) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n.toFixed(2);
}

/** Strip trailing zeros from a number: 0.1000 → "0.1", 1.50 → "1.5" */
function stripTrailingZeros(n: number): string {
  return parseFloat(n.toPrecision(6)).toString();
}
