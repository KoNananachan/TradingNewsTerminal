import { useAppStore } from '../../stores/use-app-store';
import { useAccount } from 'wagmi';
import { Database, Zap, Cpu, TerminalSquare, LinkIcon } from 'lucide-react';

export function StatusBar() {
  const lastScrapeTime = useAppStore((s) => s.lastScrapeTime);
  const articleCount = useAppStore((s) => s.articleCount);
  const wsConnected = useAppStore((s) => s.wsConnected);
  const { address, chain } = useAccount();

  return (
    <footer className="bg-panel border-t border-border h-7 flex items-center justify-between px-2 shrink-0 text-[10px] font-mono text-neutral z-20 uppercase tracking-wider">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Database className="w-3 h-3 text-accent" />
          <span>
            IDX: <span className="text-white font-bold">{articleCount.toLocaleString()}</span> DOCS
          </span>
        </div>
        {lastScrapeTime && (
          <div className="flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-accent" />
            <span>
              SYNC: <span className="text-white font-bold">{lastScrapeTime}</span>
            </span>
          </div>
        )}
      </div>

      <div className="hidden lg:flex items-center text-neutral/40 text-[9px] animate-pulse-soft">
        <span>NOT FINANCIAL ADVICE • AI ANALYSIS MAY VARY • DYOR</span>
      </div>

      <div className="flex items-center gap-4">
        {address && (
          <div className="flex items-center gap-1.5">
            <LinkIcon className="w-3 h-3 text-accent" />
            <span>
              {chain?.name === 'Arbitrum One' ? 'ARB' : chain?.name?.slice(0, 5).toUpperCase() ?? 'ETH'}:
              <span className="text-white font-bold ml-1">
                {address.slice(0, 6)}...{address.slice(-4)}
              </span>
            </span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Cpu className="w-3 h-3 text-ai" />
          <span>
            NEURAL: <span className="text-ai font-bold">ONLINE</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 ${wsConnected ? 'bg-bullish' : 'bg-bearish'}`} />
          <span className={`font-bold ${wsConnected ? 'text-bullish' : 'text-bearish'}`}>
            {wsConnected ? 'WS: SECURE' : 'WS: RECONNECTING'}
          </span>
        </div>
      </div>
    </footer>
  );
}
