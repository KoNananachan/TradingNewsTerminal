import { http, createConfig } from 'wagmi';
import { arbitrum, mainnet, polygon } from 'wagmi/chains';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';

export const config = getDefaultConfig({
  appName: 'Trading Terminal',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'trading-terminal-dev',
  chains: [arbitrum, mainnet, polygon],
  transports: {
    [arbitrum.id]: http(),
    [mainnet.id]: http(),
    [polygon.id]: http(),
  },
});
