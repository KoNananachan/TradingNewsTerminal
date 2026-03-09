import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAuthStore } from '../../stores/use-auth-store';
import { Wallet, ChevronDown, Copy, ExternalLink, Power } from 'lucide-react';

export function WalletButton() {
  const user = useAuthStore((s) => s.user);
  const setLoginModalOpen = useAuthStore((s) => s.setLoginModalOpen);

  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const connected = mounted && account && chain;

        return (
          <div
            {...(!mounted && {
              'aria-hidden': true,
              style: { opacity: 0, pointerEvents: 'none' as const, userSelect: 'none' as const },
            })}
          >
            {!connected ? (
              <button
                onClick={() => {
                  if (!user) {
                    setLoginModalOpen(true);
                  } else {
                    openConnectModal();
                  }
                }}
                title={!user ? 'Please login first' : 'Connect Wallet'}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-black border border-border text-[10px] font-black font-mono uppercase tracking-widest text-neutral hover:text-accent hover:border-accent transition-colors"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>Connect</span>
              </button>
            ) : chain.unsupported ? (
              <button
                onClick={openChainModal}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-bearish/10 border border-bearish/50 text-[10px] font-black font-mono uppercase tracking-widest text-bearish hover:bg-bearish/20 transition-colors"
              >
                Wrong Network
              </button>
            ) : (
              <div className="flex items-center gap-0">
                {/* Chain button */}
                <button
                  onClick={openChainModal}
                  className="flex items-center gap-1 px-2 py-1.5 bg-black border border-border border-r-0 text-[10px] font-mono hover:border-accent transition-colors"
                  title={chain.name}
                >
                  {chain.iconUrl && (
                    <img src={chain.iconUrl} alt={chain.name} className="w-3.5 h-3.5" />
                  )}
                  <ChevronDown className="w-2.5 h-2.5 text-neutral/50" />
                </button>

                {/* Account button */}
                <button
                  onClick={openAccountModal}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-black border border-border text-[10px] font-mono hover:border-accent transition-colors"
                >
                  <span className="w-2 h-2 bg-bullish inline-block shrink-0" />
                  <span className="text-white font-bold">{account.displayName}</span>
                  {account.displayBalance && (
                    <span className="text-neutral/50 hidden sm:inline">{account.displayBalance}</span>
                  )}
                </button>
              </div>
            )}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
