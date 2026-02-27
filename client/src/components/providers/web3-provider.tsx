import { type ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from '../../lib/wagmi-config';
import '@rainbow-me/rainbowkit/styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
    },
  },
});

const rkTheme = darkTheme({
  accentColor: '#ff9900',
  accentColorForeground: '#000000',
  borderRadius: 'none',
  fontStack: 'system',
  overlayBlur: 'small',
});

// Override specific RainbowKit theme values for terminal feel
rkTheme.colors.modalBackground = '#0a0a0a';
rkTheme.colors.modalBorder = '#333333';
rkTheme.colors.profileForeground = '#0a0a0a';
rkTheme.colors.connectButtonBackground = '#000000';
rkTheme.colors.connectButtonInnerBackground = '#111111';
rkTheme.fonts.body = "'JetBrains Mono', 'Consolas', monospace";

export function Web3Provider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={rkTheme} modalSize="compact">
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
