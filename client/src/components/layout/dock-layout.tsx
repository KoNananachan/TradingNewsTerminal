import { useCallback, useRef, useEffect } from 'react';
import { Layout, Model, type IJsonModel, type TabNode, type Action, Actions, DockLocation } from 'flexlayout-react';
// CSS imported via index.css to avoid duplication

import { lazy, Suspense } from 'react';
import { NewsFeed } from '../panels/news-feed';
import { StockPanel } from '../panels/stock-panel';
import { AiInsights } from '../panels/ai-insights';
import { AiChatPanel } from '../panels/ai-chat-panel';
import { TerminalLog } from '../layout/terminal-log';
import { useAppStore } from '../../stores/use-app-store';

// Lazy load heavy panels
const WorldMapPanel = lazy(() => import('../panels/world-map-panel').then(m => ({ default: m.WorldMapPanel })));
const TradingPanel = lazy(() => import('../panels/trading-panel').then(m => ({ default: m.TradingPanel })));

function LazyWrap({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full bg-black">
        <span className="text-[10px] font-mono text-accent animate-pulse uppercase tracking-widest">Loading...</span>
      </div>
    }>
      {children}
    </Suspense>
  );
}

const STORAGE_KEY = 'terminal-layout';

export const PANEL_IDS = {
  NEWS: 'news-feed',
  MAP: 'world-map',
  STOCKS: 'market-watch',
  AI: 'ai-insights',
  LOG: 'terminal-log',
  TRADING: 'trading',
  AI_CHAT: 'ai-chat',
} as const;

export const PANEL_NAMES: Record<string, string> = {
  [PANEL_IDS.NEWS]: 'NEWS FEED',
  [PANEL_IDS.MAP]: 'WORLD MAP',
  [PANEL_IDS.STOCKS]: 'MARKET WATCH',
  [PANEL_IDS.AI]: 'AI INSIGHTS',
  [PANEL_IDS.LOG]: 'TERMINAL LOG',
  [PANEL_IDS.TRADING]: 'TRADING',
  [PANEL_IDS.AI_CHAT]: 'AI CHAT',
};

export const ALL_PANEL_IDS = Object.values(PANEL_IDS);

/*
 * Professional layout (root row = horizontal, nested row = vertical):
 *
 * +--- 20% ---+---------- 50% ----------+------- 30% -------+
 * |           |                          | MARKET WATCH (tab) |
 * |           |                          | AI INSIGHTS  (tab) |
 * | NEWS FEED |        WORLD MAP         | (55%)              |
 * |           |         (70%)            +--------------------+
 * |           |                          | TRADING            |
 * |           +--------------------------+ (45%)              |
 * |           |     TERMINAL LOG (30%)   |                    |
 * +-----------+--------------------------+--------------------+
 */
const DEFAULT_LAYOUT: IJsonModel = {
  global: {
    tabEnableClose: true,
    tabEnableRename: false,
    tabSetEnableMaximize: true,
    tabSetEnableClose: false,
    splitterSize: 2,
    splitterExtra: 6,
    tabSetMinHeight: 80,
    tabSetMinWidth: 80,
  },
  borders: [],
  layout: {
    type: 'row', // L0 horizontal: children are side-by-side
    weight: 100,
    children: [
      // Left column: News Feed (full height)
      {
        type: 'tabset',
        weight: 20,
        children: [
          { type: 'tab', name: 'NEWS FEED', component: PANEL_IDS.NEWS, id: PANEL_IDS.NEWS },
        ],
      },
      // Center column: Map on top, Log on bottom (L1 vertical)
      {
        type: 'row',
        weight: 50,
        children: [
          {
            type: 'tabset',
            weight: 70,
            children: [
              { type: 'tab', name: 'WORLD MAP', component: PANEL_IDS.MAP, id: PANEL_IDS.MAP },
            ],
          },
          {
            type: 'tabset',
            weight: 30,
            children: [
              { type: 'tab', name: 'TERMINAL LOG', component: PANEL_IDS.LOG, id: PANEL_IDS.LOG },
            ],
          },
        ],
      },
      // Right column: Market+AI on top, Trading on bottom (L1 vertical)
      {
        type: 'row',
        weight: 30,
        children: [
          {
            type: 'tabset',
            weight: 55,
            children: [
              { type: 'tab', name: 'MARKET WATCH', component: PANEL_IDS.STOCKS, id: PANEL_IDS.STOCKS },
              { type: 'tab', name: 'AI INSIGHTS', component: PANEL_IDS.AI, id: PANEL_IDS.AI },
              { type: 'tab', name: 'AI CHAT', component: PANEL_IDS.AI_CHAT, id: PANEL_IDS.AI_CHAT },
            ],
          },
          {
            type: 'tabset',
            weight: 45,
            children: [
              { type: 'tab', name: 'TRADING', component: PANEL_IDS.TRADING, id: PANEL_IDS.TRADING },
            ],
          },
        ],
      },
    ],
  },
};

/** Build a layout from default, excluding hidden panels */
function buildLayout(hiddenPanels: string[]): IJsonModel {
  if (hiddenPanels.length === 0) return DEFAULT_LAYOUT;

  const layout = JSON.parse(JSON.stringify(DEFAULT_LAYOUT)) as IJsonModel;

  function prune(node: any): boolean {
    if (!node.children) return true;
    node.children = node.children.filter((child: any) => {
      // Remove hidden tabs
      if (child.type === 'tab' && hiddenPanels.includes(child.id)) return false;
      // Recurse
      return prune(child);
    });
    // Remove empty tabsets or rows
    if ((node.type === 'tabset' || node.type === 'row') && node.children.length === 0) return false;
    return true;
  }

  prune(layout.layout);
  return layout;
}

function loadModel(): Model {
  // Check if a reset was requested
  if (localStorage.getItem(RESET_FLAG)) {
    localStorage.removeItem(RESET_FLAG);
    localStorage.removeItem(STORAGE_KEY);
    const hiddenPanels = useAppStore.getState().hiddenPanels;
    return Model.fromJson(buildLayout(hiddenPanels));
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const json = JSON.parse(saved) as IJsonModel;
      if (json.global) json.global.tabEnableClose = true;
      return Model.fromJson(json);
    }
  } catch {
    // corrupt data, fall through
  }
  const hiddenPanels = useAppStore.getState().hiddenPanels;
  return Model.fromJson(buildLayout(hiddenPanels));
}

// Module-level model ref
let _modelRef: Model | null = null;

export function getModel(): Model | null {
  return _modelRef;
}

/**
 * Show a hidden panel: rebuild layout from default with current visible panels.
 * This ensures the panel appears in its proper position.
 */
export function showPanelInLayout(_panelId: string) {
  // Use the reset flag so beforeunload doesn't overwrite
  localStorage.setItem(RESET_FLAG, '1');
  window.location.reload();
}

// Component registry
type PanelFactory = (node: TabNode) => React.ReactNode;
const extraFactories: Map<string, PanelFactory> = new Map();

export function addPanelFactory(id: string, factory: PanelFactory) {
  extraFactories.set(id, factory);
}

export function DockLayout() {
  const modelRef = useRef<Model>(loadModel());
  const hidePanel = useAppStore((s) => s.hidePanel);

  useEffect(() => {
    _modelRef = modelRef.current;
    return () => { _modelRef = null; };
  }, []);

  const saveLayout = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(modelRef.current.toJson()));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    window.addEventListener('beforeunload', saveLayout);
    return () => window.removeEventListener('beforeunload', saveLayout);
  }, [saveLayout]);

  const handleAction = useCallback((action: Action): Action | undefined => {
    if (action.type === Actions.DELETE_TAB) {
      const tabId = (action as any).data?.node;
      if (tabId && ALL_PANEL_IDS.includes(tabId)) {
        hidePanel(tabId);
      }
    }
    return action;
  }, [hidePanel]);

  const factory = useCallback((node: TabNode) => {
    const component = node.getComponent();
    switch (component) {
      case PANEL_IDS.NEWS: return <NewsFeed />;
      case PANEL_IDS.MAP: return <LazyWrap><WorldMapPanel /></LazyWrap>;
      case PANEL_IDS.STOCKS: return <StockPanel />;
      case PANEL_IDS.AI: return <AiInsights />;
      case PANEL_IDS.LOG: return <TerminalLog />;
      case PANEL_IDS.TRADING: return <LazyWrap><TradingPanel /></LazyWrap>;
      case PANEL_IDS.AI_CHAT: return <AiChatPanel />;
      default: {
        const extra = extraFactories.get(component ?? '');
        if (extra) return extra(node);
        return <div className="flex items-center justify-center h-full text-neutral text-xs font-mono uppercase">Unknown panel: {component}</div>;
      }
    }
  }, []);

  return (
    <Layout
      model={modelRef.current}
      factory={factory}
      onAction={handleAction}
      onModelChange={saveLayout}
    />
  );
}

const RESET_FLAG = 'terminal-layout-reset';

export function resetLayout() {
  localStorage.setItem(RESET_FLAG, '1');
  useAppStore.setState({ hiddenPanels: [] });
  window.location.reload();
}
