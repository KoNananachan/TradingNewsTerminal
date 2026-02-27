import { http, createConfig } from 'wagmi';
import { arbitrum, mainnet } from 'wagmi/chains';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';

export const config = getDefaultConfig({
  appName: 'Trading Terminal',
  projectId: 'trading-terminal-dev', // Replace with WalletConnect Cloud project ID for production
  chains: [arbitrum, mainnet],
  transports: {
    [arbitrum.id]: http(),
    [mainnet.id]: http(),
  },
});
