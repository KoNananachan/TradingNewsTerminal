import { useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { api } from '../api/client';

export function useSessionTracker() {
  const { address, isConnected, chain } = useAccount();
  const prevRef = useRef<{ address?: string; connected: boolean }>({
    connected: false,
  });

  useEffect(() => {
    const prev = prevRef.current;

    if (isConnected && address) {
      if (!prev.connected) {
        // New connection
        reportSession(address, chain?.id, 'connect');
      } else if (prev.address && prev.address !== address) {
        // Address switched: disconnect old, connect new
        reportSession(prev.address, chain?.id, 'disconnect');
        reportSession(address, chain?.id, 'connect');
      }
    } else if (!isConnected && prev.connected && prev.address) {
      // Disconnected
      reportSession(prev.address, chain?.id, 'disconnect');
    }

    prevRef.current = { address, connected: isConnected };
  }, [isConnected, address, chain?.id]);
}

function reportSession(
  walletAddress: string,
  chainId: number | undefined,
  eventType: 'connect' | 'disconnect',
) {
  api
    .post('/audit/session', {
      walletAddress,
      chainId: chainId ?? null,
      eventType,
      userAgent: navigator.userAgent,
    })
    .catch(() => {
      // fire-and-forget, don't block UI
    });
}
