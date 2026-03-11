import { useState, useMemo, useCallback, useEffect } from 'react';
import { useAccount, useBalance, useSignTypedData, useSwitchChain } from 'wagmi';
import { parseSignature } from 'viem';
import { arbitrum, arbitrumSepolia } from 'wagmi/chains';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCombinedMids,
  useUserState,
  useSpotBalances,
  usePerpMetaAndCtxs,
  useStockPerps,
} from '../../hooks/use-hyperliquid';
import { useAppStore } from '../../stores/use-app-store';
import { useT } from '../../i18n';
import { api } from '../../api/client';
import { Wallet, ArrowDownUp, Loader2, KeyRound } from 'lucide-react';
import {
  USER_SIGN_DOMAIN,
  USD_TRANSFER_TYPES,
  buildOrderAction,
  formatPrice,
  formatSize,
  applySlippage,
  getDexOffsets,
  getDexPrefix,
  type OrderWire,
} from '../../lib/hyperliquid/signing';
import {
  signL1Action,
  getAgentWallet,
  generateAgentWallet,
  saveAgentWallet,
  removeAgentWallet,
  approveAgent,
  type AgentWallet,
} from '../../lib/hyperliquid/agent-wallet';

import type { MarketType } from './market-overview';

// USDC on Arbitrum One
const USDC_ARB = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as const;
const HL_EXCHANGE_URL = 'https://api.hyperliquid.xyz/exchange';

interface TradeFormProps {
  coin: string;
  coinType?: MarketType;
}

export function TradeForm({ coin, coinType = 'crypto' }: TradeFormProps) {
  const { isConnected, address } = useAccount();
  const { data: mids } = useCombinedMids();
  const { data: userState } = useUserState();
  const { data: spotState } = useSpotBalances();
  const { data: perpMeta } = usePerpMetaAndCtxs();
  const { data: stockMeta } = useStockPerps();
  const { data: onChainUsdc } = useBalance({
    address,
    token: USDC_ARB,
    chainId: arbitrum.id,
  });
  const { signTypedDataAsync } = useSignTypedData();
  const { switchChainAsync } = useSwitchChain();
  const queryClient = useQueryClient();

  const quoteCurrency = 'USDC';
  const addLogEntry = useAppStore((s) => s.addLogEntry);
  const addNotification = useAppStore((s) => s.addNotification);
  const tradingSourceArticleId = useAppStore((s) => s.tradingSourceArticleId);

  const t = useT();
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [size, setSize] = useState('');
  const [price, setPrice] = useState('');
  const [leverage, setLeverage] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [lastStatus, setLastStatus] = useState<string | null>(null);

  // Agent wallet for local L1 signing (avoids MetaMask chainId 1337 issue)
  const [agentWallet, setAgentWallet] = useState<AgentWallet | null>(null);
  const [approving, setApproving] = useState(false);

  // Load existing agent wallet on mount / address change
  useEffect(() => {
    if (address) {
      setAgentWallet(getAgentWallet(address));
    } else {
      setAgentWallet(null);
    }
  }, [address]);

  // Transfer state
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferDir, setTransferDir] = useState<'toPerp' | 'toSpot'>('toPerp');
  const [transferAmt, setTransferAmt] = useState('');
  const [transferring, setTransferring] = useState(false);

  const midPrice = mids?.[coin] ? parseFloat(mids[coin]) : null;

  // Resolve asset index (global) and szDecimals from meta
  const [dexOffsetMap, setDexOffsetMap] = useState<Record<string, number> | null>(null);

  // Fetch dex offsets once (retry on failure)
  useEffect(() => {
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    getDexOffsets().then(setDexOffsetMap).catch((err) => {
      console.error('[TradeForm] Failed to load dex offsets:', err?.message);
      retryTimer = setTimeout(() => {
        getDexOffsets().then(setDexOffsetMap).catch(() => {});
      }, 5000);
    });
    return () => { if (retryTimer) clearTimeout(retryTimer); };
  }, []);

  const assetInfo = useMemo(() => {
    // Regular perps (offset 0)
    if (perpMeta) {
      const idx = perpMeta[0].universe.findIndex((a) => a.name === coin);
      if (idx >= 0) {
        return { index: idx, szDecimals: perpMeta[0].universe[idx].szDecimals, isStock: false };
      }
    }
    // Builder dex perps (offset from perpDexs)
    if (stockMeta && dexOffsetMap) {
      const idx = stockMeta[0].universe.findIndex((a) => a.name === coin);
      if (idx >= 0) {
        const dexName = getDexPrefix(coin);
        const offset = dexOffsetMap[dexName] ?? 0;
        return { index: offset + idx, szDecimals: stockMeta[0].universe[idx].szDecimals, isStock: true };
      }
    }
    return null;
  }, [perpMeta, stockMeta, coin, dexOffsetMap]);

  // Available balance from Hyperliquid perps account (USDC withdrawable)
  const perpAvailable = useMemo(() => {
    if (!userState) return null;
    return parseFloat(userState.withdrawable);
  }, [userState]);

  // Spot USDC balance on Hyperliquid
  const spotUsdc = useMemo(() => {
    if (!spotState?.balances) return null;
    const usdcBal = spotState.balances.find((b) => b.coin === 'USDC');
    if (!usdcBal) return null;
    return parseFloat(usdcBal.total);
  }, [spotState]);

  // Total available = perps withdrawable + spot USDC
  const availableUsd = useMemo(() => {
    if (perpAvailable == null && spotUsdc == null) return null;
    return (perpAvailable ?? 0) + (spotUsdc ?? 0);
  }, [perpAvailable, spotUsdc]);

  // Max size user can open at current price & leverage
  const maxSize = useMemo(() => {
    if (availableUsd == null || !midPrice || midPrice <= 0) return null;
    const effectivePrice = orderType === 'limit' && price ? parseFloat(price) : midPrice;
    if (!effectivePrice || effectivePrice <= 0 || !Number.isFinite(effectivePrice)) return null;
    const raw = (availableUsd * leverage) / effectivePrice;
    return Number.isFinite(raw) ? raw : null;
  }, [availableUsd, midPrice, leverage, orderType, price]);

  const setSizePercent = (pct: number) => {
    if (maxSize == null) return;
    const val = maxSize * pct;
    setSize(val >= 1 ? val.toFixed(4) : val.toPrecision(4));
  };

  // Setup agent wallet: generate key, approve via MetaMask on Arbitrum
  const handleSetupAgent = useCallback(async () => {
    if (!address || approving) return;
    setApproving(true);
    setLastStatus(t('settingUpKey'));
    try {
      // Clear any old agent key first
      removeAgentWallet(address);
      setAgentWallet(null);

      await switchChainAsync({ chainId: arbitrumSepolia.id });
      const agent = generateAgentWallet();
      setLastStatus(t('approveInWallet'));
      await approveAgent(signTypedDataAsync, agent.address);
      saveAgentWallet(address, agent);
      setAgentWallet(agent);
      setLastStatus(t('keyApproved'));
    } catch (err: any) {
      if (err?.name === 'UserRejectedRequestError' || err?.code === 4001) {
        setLastStatus(t('cancelled'));
        return;
      }
      const msg = err?.shortMessage || err?.message || t('unknownError');
      setLastStatus(`${t('setupFailed')}: ${msg}`);
    } finally {
      setApproving(false);
    }
  }, [address, approving, switchChainAsync, signTypedDataAsync, t]);

  // Transfer USDC between Spot ↔ Perps
  const handleTransfer = useCallback(async () => {
    const amt = parseFloat(transferAmt);
    if (!amt || amt <= 0 || !address) return;

    setTransferring(true);
    try {
      // Ensure on Arbitrum Sepolia for USER_SIGN_DOMAIN (chainId 421614)
      await switchChainAsync({ chainId: arbitrumSepolia.id });

      const nonce = Date.now();
      const toPerp = transferDir === 'toPerp';

      const signature = await signTypedDataAsync({
        domain: USER_SIGN_DOMAIN,
        types: USD_TRANSFER_TYPES,
        primaryType: 'HyperliquidTransaction:UsdClassTransfer',
        message: {
          hyperliquidChain: 'Mainnet' as const,
          amount: String(amt),
          toPerp,
          nonce: BigInt(nonce),
        },
      });

      const { r, s, v } = parseSignature(signature);

      const res = await fetch(HL_EXCHANGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: {
            type: 'usdClassTransfer',
            amount: String(amt),
            toPerp,
            nonce,
            hyperliquidChain: 'Mainnet',
            signatureChainId: '0x66eee',
          },
          nonce,
          signature: { r, s, v: Number(v) },
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) throw new Error(`Transfer HTTP ${res.status}`);
      const data = await res.json();
      if (data.status === 'ok') {
        addLogEntry({ type: 'trade', message: `${t('transferSuccess')}: ${amt} USDC → ${toPerp ? 'Perps' : 'Spot'}` });
        addNotification({
          id: Date.now(),
          title: `${t('transferSuccess')}: ${amt} USDC → ${toPerp ? 'Perps' : 'Spot'}`,
          sentiment: 'positive',
          symbols: [],
          time: new Date(),
        });
        setTransferAmt('');
        setShowTransfer(false);
        queryClient.invalidateQueries({ queryKey: ['hl', 'userState'] });
        queryClient.invalidateQueries({ queryKey: ['hl', 'spotBalances'] });
      } else {
        throw new Error(data.response?.payload || JSON.stringify(data));
      }
    } catch (err: any) {
      if (err?.name === 'UserRejectedRequestError' || err?.code === 4001) return;
      const msg = err?.shortMessage || err?.message || 'Unknown error';
      addLogEntry({ type: 'alert', message: `${t('transferFailed')}: ${msg}` });
    } finally {
      setTransferring(false);
    }
  }, [transferAmt, transferDir, address, signTypedDataAsync, switchChainAsync, addLogEntry, addNotification, queryClient, t]);

  // Place a real order on Hyperliquid via agent wallet (local signing)
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLastStatus('Starting...');
    if (!isConnected || !size || !address || !assetInfo || !agentWallet) {
      setLastStatus(`Blocked: connected=${isConnected} size=${!!size} addr=${!!address} asset=${!!assetInfo} agent=${!!agentWallet}`);
      return;
    }

    const sizeVal = parseFloat(size);
    if (isNaN(sizeVal) || sizeVal <= 0 || !Number.isFinite(sizeVal)) {
      setLastStatus(t('invalidSize'));
      return;
    }

    // Validate formatted size is non-zero (could round to 0 with few szDecimals)
    const formattedSize = formatSize(sizeVal, assetInfo.szDecimals);
    if (parseFloat(formattedSize) <= 0) {
      setLastStatus(`${t('sizeTooSmall')} (min ${Math.pow(10, -assetInfo.szDecimals)})`);
      return;
    }

    const isBuy = side === 'buy';
    let orderPrice: number;
    let tif: 'Gtc' | 'Ioc';

    if (orderType === 'market') {
      if (!midPrice) { setLastStatus(`No midPrice for ${coin}`); return; }
      orderPrice = applySlippage(midPrice, isBuy);
      tif = 'Ioc';
    } else {
      orderPrice = parseFloat(price);
      if (isNaN(orderPrice) || orderPrice <= 0 || !Number.isFinite(orderPrice)) {
        setLastStatus(t('invalidLimitPrice'));
        return;
      }
      tif = 'Gtc';
    }

    const orderWire: OrderWire = {
      a: assetInfo.index,
      b: isBuy,
      p: formatPrice(orderPrice),
      s: formatSize(sizeVal, assetInfo.szDecimals),
      r: false,
      t: { limit: { tif } },
    };

    const action = buildOrderAction([orderWire]);

    const orderDesc = `${side.toUpperCase()} ${formatSize(sizeVal, assetInfo.szDecimals)} ${displayCoin(coin)} @ ${orderType === 'market' ? 'MKT' : '$' + orderPrice.toFixed(2)} (${leverage}x)`;

    setSubmitting(true);
    setLastStatus(t('settingLeverage'));
    try {
      // Set leverage before placing order
      const levAction = {
        type: 'updateLeverage',
        asset: assetInfo.index,
        isCross: true,
        leverage,
      };
      const levNonce = Date.now();
      const levSig = await signL1Action(
        agentWallet.privateKey,
        levAction as Record<string, unknown>,
        levNonce,
      );
      const levRes = await fetch(HL_EXCHANGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: levAction,
          nonce: levNonce,
          signature: levSig,
          vaultAddress: null,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!levRes.ok) throw new Error(`Leverage update HTTP ${levRes.status}`);
      const levData = await levRes.json();
      if (levData.status !== 'ok') {
        const levErr = levData.response?.payload || levData.response || 'unknown';
        throw new Error(`Leverage update failed: ${levErr}`);
      }

      setLastStatus(t('signingLocally'));
      // Ensure nonce is unique: at least 1ms after leverage nonce
      const nonce = Math.max(Date.now(), levNonce + 1);
      const { r, s, v } = await signL1Action(
        agentWallet.privateKey,
        action as Record<string, unknown>,
        nonce,
      );

      const requestBody = {
        action,
        nonce,
        signature: { r, s, v },
        vaultAddress: null,
      };
      if (import.meta.env.DEV) {
        console.log('[TradeForm] Order request:', JSON.stringify(requestBody, null, 2));
      }

      const res = await fetch(HL_EXCHANGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) throw new Error(`Order HTTP ${res.status}`);
      const data = await res.json();
      if (import.meta.env.DEV) console.log('[TradeForm] Order response:', JSON.stringify(data));

      if (data.status === 'ok') {
        const statuses = data.response?.data?.statuses ?? [];
        const status = statuses[0];
        const filled = status?.filled;
        const resting = status?.resting;
        const error = status?.error;

        let resultMsg: string;
        let sentiment: string | null = 'positive';
        if (error) {
          resultMsg = `Order rejected: ${error}`;
          sentiment = 'negative';
        } else if (filled) {
          resultMsg = `Filled: ${filled.totalSz} @ $${filled.avgPx}`;
        } else if (resting) {
          resultMsg = `Order placed (oid: ${resting.oid})`;
        } else {
          resultMsg = `Order submitted`;
        }

        setLastStatus(resultMsg);
        addLogEntry({ type: 'trade', message: `${orderDesc} — ${resultMsg}` });
        addNotification({
          id: Date.now(),
          title: `${orderDesc}`,
          sentiment,
          symbols: [coin],
          time: new Date(),
        });

        setSize('');
        setPrice('');
        queryClient.invalidateQueries({ queryKey: ['hl', 'userState'] });
        queryClient.invalidateQueries({ queryKey: ['hl', 'stockUserState'] });
        queryClient.invalidateQueries({ queryKey: ['hl', 'spotBalances'] });
      } else {
        throw new Error(data.response?.payload || JSON.stringify(data));
      }

      // Audit log
      const notional = sizeVal * (orderPrice || 0);
      api.post('/audit/trade', {
        walletAddress: address,
        coin,
        side,
        orderType,
        size: sizeVal,
        price: orderPrice,
        leverage,
        midPrice: midPrice ?? undefined,
        notionalValue: notional || undefined,
        marginRequired: notional ? notional / leverage : undefined,
        status: 'submitted',
        sourceArticleId: tradingSourceArticleId ?? undefined,
      }).catch(() => {});
    } catch (err: any) {
      if (err?.name === 'UserRejectedRequestError' || err?.code === 4001) {
        setLastStatus(t('userRejected'));
        return;
      }
      const msg = err?.shortMessage || err?.message || t('unknownError');
      setLastStatus(`Error: ${msg}`);
      addLogEntry({ type: 'alert', message: `Order failed: ${msg}` });
      addNotification({
        id: Date.now(),
        title: `Order failed: ${msg}`,
        sentiment: 'negative',
        symbols: [coin],
        time: new Date(),
      });
    } finally {
      setSubmitting(false);
    }
  }, [isConnected, size, address, assetInfo, agentWallet, side, orderType, midPrice, price, leverage, coin, addLogEntry, addNotification, queryClient, tradingSourceArticleId, t]);

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
          {t('long')}
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
          {t('short')}
        </button>
      </div>

      {/* Order type */}
      <div className="flex gap-2">
        {(['market', 'limit'] as const).map((ot) => (
          <button
            key={ot}
            type="button"
            onClick={() => setOrderType(ot)}
            className={`flex-1 py-1 text-[9px] font-bold uppercase tracking-widest border ${
              orderType === ot
                ? 'text-accent border-accent bg-accent/5'
                : 'text-neutral/40 border-border/20 hover:text-neutral'
            }`}
          >
            {ot}
          </button>
        ))}
      </div>

      {/* Price input (limit only) */}
      {orderType === 'limit' && (
        <div>
          <label className="text-[8px] font-black uppercase tracking-[0.15em] text-neutral/50 mb-1 block">
            {t('priceUsd')}
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
        <div className="flex flex-col gap-0.5 px-1 py-1.5 border border-border/20 bg-black/40 rounded">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Wallet className="w-3 h-3 text-accent/60" />
              <span className="text-[8px] font-black uppercase tracking-[0.1em] text-neutral/50">{t('available')}</span>
            </div>
            <span className="text-[11px] font-mono font-bold text-white">
              {availableUsd != null ? `$${fmtUsd(availableUsd)}` : '—'}
              <span className="text-[8px] text-neutral/40 ml-1">{quoteCurrency}</span>
            </span>
          </div>
          <div className="flex items-center justify-between pl-[18px]">
            <span className="text-[7px] font-bold uppercase tracking-[0.1em] text-neutral/35">Perps</span>
            <span className="text-[9px] font-mono text-neutral/50">${fmtUsd(perpAvailable ?? 0)}</span>
          </div>
          <div className="flex items-center justify-between pl-[18px]">
            <span className="text-[7px] font-bold uppercase tracking-[0.1em] text-neutral/35">Spot</span>
            <span className="text-[9px] font-mono text-neutral/50">${fmtUsd(spotUsdc ?? 0)}</span>
          </div>
          {onChainUsdc && (
            <div className="flex items-center justify-between pl-[18px]">
              <span className="text-[7px] font-bold uppercase tracking-[0.1em] text-neutral/35">Wallet</span>
              <span className="text-[9px] font-mono text-neutral/50">
                {parseFloat(onChainUsdc.formatted).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}
          {/* Transfer toggle */}
          <button
            type="button"
            onClick={() => setShowTransfer(!showTransfer)}
            className="flex items-center justify-center gap-1 mt-0.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.1em] text-accent/60 hover:text-accent transition-colors"
          >
            <ArrowDownUp className="w-2.5 h-2.5" />
            {t('spotPerpsTransfer')}
          </button>
          {showTransfer && (
            <div className="flex flex-col gap-1 mt-1 p-2 border border-accent/20 bg-accent/[0.03] rounded">
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setTransferDir('toPerp')}
                  className={`flex-1 py-0.5 text-[7px] font-bold uppercase tracking-wider border ${
                    transferDir === 'toPerp'
                      ? 'text-accent border-accent bg-accent/10'
                      : 'text-neutral/40 border-border/20'
                  }`}
                >
                  {t('toPerps')}
                </button>
                <button
                  type="button"
                  onClick={() => setTransferDir('toSpot')}
                  className={`flex-1 py-0.5 text-[7px] font-bold uppercase tracking-wider border ${
                    transferDir === 'toSpot'
                      ? 'text-accent border-accent bg-accent/10'
                      : 'text-neutral/40 border-border/20'
                  }`}
                >
                  {t('toSpot')}
                </button>
              </div>
              <div className="flex gap-1">
                <input
                  type="number"
                  step="any"
                  value={transferAmt}
                  onChange={(e) => setTransferAmt(e.target.value)}
                  placeholder="USDC"
                  className="flex-1 bg-black/60 border border-border/30 px-2 py-1 text-[10px] font-mono text-white placeholder:text-neutral/30"
                />
                <button
                  type="button"
                  onClick={() => {
                    const max = transferDir === 'toPerp' ? spotUsdc : perpAvailable;
                    if (max != null && max > 0) setTransferAmt(max.toFixed(2));
                  }}
                  className="px-1.5 py-1 text-[7px] font-bold text-accent/60 border border-border/20 hover:text-accent"
                >
                  {t('max')}
                </button>
              </div>
              <button
                type="button"
                onClick={handleTransfer}
                disabled={transferring || !transferAmt || parseFloat(transferAmt) <= 0}
                className="py-1 text-[8px] font-black uppercase tracking-widest bg-accent/20 text-accent border border-accent hover:bg-accent/30 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {transferring ? '...' : transferDir === 'toPerp' ? t('transferToPerps') : t('transferToSpot')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Size input */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[8px] font-black uppercase tracking-[0.15em] text-neutral/50">
            {t('size')} ({displayCoin(coin)})
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
          {t('leverage')}
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
            <span>{t('notionalValue')}:</span>
            <span className="text-white font-bold">
              ${fmtUsd(parseFloat(size || '0') * (orderType === 'limit' ? parseFloat(price || '0') : midPrice))}
            </span>
          </div>
          <div className="flex justify-between">
            <span>{t('marginRequired')}:</span>
            <span className="text-accent font-bold">
              ${fmtUsd(parseFloat(size || '0') * (orderType === 'limit' ? parseFloat(price || '0') : midPrice) / leverage)}
            </span>
          </div>
        </div>
      )}

      {/* Status */}
      {lastStatus && (
        <div className="text-[8px] font-mono text-amber-400/70 px-1">{lastStatus}</div>
      )}

      {/* Setup agent key (one-time) */}
      {isConnected && !agentWallet && (
        <button
          type="button"
          onClick={handleSetupAgent}
          disabled={approving}
          className="py-2.5 text-[11px] font-black uppercase tracking-widest border flex items-center justify-center gap-2 bg-accent/20 text-accent border-accent hover:bg-accent/30 disabled:opacity-40"
        >
          {approving ? <Loader2 className="w-3 h-3 animate-spin" /> : <KeyRound className="w-3 h-3" />}
          {approving ? t('approvingKey') : t('setupTradingKey')}
        </button>
      )}
      {isConnected && agentWallet && (
        <button
          type="button"
          onClick={handleSetupAgent}
          disabled={approving}
          className="text-[7px] font-mono text-neutral/40 hover:text-accent/60 transition-colors"
        >
          {approving ? t('approvingKey') : t('resetTradingKey')}
        </button>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={!isConnected || !size || submitting || !assetInfo || !agentWallet}
        className={`py-2.5 text-[11px] font-black uppercase tracking-widest border flex items-center justify-center gap-2 ${
          side === 'buy'
            ? 'bg-bullish/20 text-bullish border-bullish hover:bg-bullish/30 disabled:bg-bullish/5 disabled:text-bullish/30 disabled:border-bullish/20'
            : 'bg-bearish/20 text-bearish border-bearish hover:bg-bearish/30 disabled:bg-bearish/5 disabled:text-bearish/30 disabled:border-bearish/20'
        }`}
      >
        {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
        {!isConnected
          ? t('connectWallet')
          : submitting
            ? t('signingOrder')
            : !assetInfo
              ? `Loading ${displayCoin(coin)}...`
              : `${side === 'buy' ? t('long') : t('short')} ${displayCoin(coin)}`}
      </button>
    </form>
  );
}

function displayCoin(coin: string): string {
  return coin.startsWith('xyz:') ? coin.slice(4) : coin;
}

function fmtUsd(n: number): string {
  if (isNaN(n)) return '0.00';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n.toFixed(2);
}
