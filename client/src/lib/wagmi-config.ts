import { http, createConfig } from 'wagmi';
import { arbitrum, arbitrumSepolia, mainnet, polygon } from 'wagmi/chains';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';

export const config = getDefaultConfig({
  appName: 'Trading Terminal',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'trading-terminal-dev',
  chains: [arbitrum, arbitrumSepolia, mainnet, polygon],
  transports: {
    [arbitrum.id]: http(),
    [arbitrumSepolia.id]: http(),
    [mainnet.id]: http(),
    [polygon.id]: http(),
  },
});
