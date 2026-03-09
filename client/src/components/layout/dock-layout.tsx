import { useCallback, useRef, useEffect } from 'react';
import { Layout, Model, type IJsonModel, type TabNode, type Action, Actions, DockLocation } from 'flexlayout-react';
// CSS imported via index.css to avoid duplication

import { lazy, Suspense } from 'react';
import { NewsFeed } from '../panels/news-feed';
import { StockPanel } from '../panels/stock-panel';
import { AiInsights } from '../panels/ai-insights';
import { TerminalLog } from '../layout/terminal-log';
import { PanelErrorBoundary } from '../common/error-boundary';
import { useAppStore } from '../../stores/use-app-store';
import { translations, type TranslationKey } from '../../i18n/translations';

// Lazy load heavy panels
const WorldMapPanel = lazy(() => import('../panels/world-map-panel').then(m => ({ default: m.WorldMapPanel })));
const TradingPanel = lazy(() => import('../panels/trading-panel').then(m => ({ default: m.TradingPanel })));
const EconomicCalendarPanel = lazy(() => import('../panels/economic-calendar-panel').then(m => ({ default: m.EconomicCalendarPanel })));
const AlertsPanel = lazy(() => import('../panels/alerts-panel').then(m => ({ default: m.AlertsPanel })));
const SentimentPanel = lazy(() => import('../panels/sentiment-panel').then(m => ({ default: m.SentimentPanel })));
const RiskCalculator = lazy(() => import('../panels/risk-calculator').then(m => ({ default: m.RiskCalculator })));
const SectorRotationPanel = lazy(() => import('../panels/sector-rotation-panel').then(m => ({ default: m.SectorRotationPanel })));
const EarningsCalendarPanel = lazy(() => import('../panels/earnings-calendar-panel').then(m => ({ default: m.EarningsCalendarPanel })));
const OptionsFlowPanel = lazy(() => import('../panels/options-flow-panel').then(m => ({ default: m.OptionsFlowPanel })));
const InsiderTradesPanel = lazy(() => import('../panels/insider-trades-panel').then(m => ({ default: m.InsiderTradesPanel })));
const CorrelationMatrixPanel = lazy(() => import('../panels/correlation-matrix-panel').then(m => ({ default: m.CorrelationMatrixPanel })));
const LiveStreamsPanel = lazy(() => import('../panels/live-streams-panel').then(m => ({ default: m.LiveStreamsPanel })));
const PredictionTradingPanel = lazy(() => import('../panels/prediction-trading-panel').then(m => ({ default: m.PredictionTradingPanel })));

function LazyWrap({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center h-full bg-black gap-2">
        <div className="w-5 h-5 border-2 border-accent/30 border-t-accent animate-spin" />
        <span className="text-[10px] font-mono text-neutral/40 uppercase tracking-widest">Initializing...</span>
      </div>
    }>
      {children}
    </Suspense>
  );
}

const STORAGE_KEY = 'terminal-layout';
const LAYOUT_VERSION_KEY = 'terminal-layout-version';
const LAYOUT_VERSION = 10; // bump this when default layout changes to force reset

export const PANEL_IDS = {
  NEWS: 'news-feed',
  MAP: 'world-map',
  STOCKS: 'market-watch',
  AI: 'ai-insights',
  LOG: 'terminal-log',
  TRADING: 'trading',
  AI_CHAT: 'ai-chat',
  ECON_CALENDAR: 'econ-calendar',
  ALERTS: 'alerts',
  SENTIMENT: 'sentiment',
  RISK: 'risk-calculator',
  SECTORS: 'sector-rotation',
  EARNINGS: 'earnings-calendar',
  OPTIONS: 'options-flow',
  INSIDERS: 'insider-trades',
  CORRELATIONS: 'correlation-matrix',
  LIVE_STREAMS: 'live-streams',
  PREDICTION: 'prediction-trading',
} as const;

export const PANEL_NAMES: Record<string, string> = {
  [PANEL_IDS.NEWS]: 'NEWS FEED',
  [PANEL_IDS.MAP]: 'WORLD MAP',
  [PANEL_IDS.STOCKS]: 'MARKET WATCH',
  [PANEL_IDS.AI]: 'AI INSIGHTS',
  [PANEL_IDS.LOG]: 'TERMINAL LOG',
  [PANEL_IDS.TRADING]: 'STOCK TRADING',
  [PANEL_IDS.AI_CHAT]: 'AI CHAT',
  [PANEL_IDS.ECON_CALENDAR]: 'ECONOMIC CALENDAR',
  [PANEL_IDS.ALERTS]: 'ALERTS',
  [PANEL_IDS.SENTIMENT]: 'SENTIMENT',
  [PANEL_IDS.RISK]: 'RISK CALCULATOR',
  [PANEL_IDS.SECTORS]: 'SECTOR ROTATION',
  [PANEL_IDS.EARNINGS]: 'EARNINGS CALENDAR',
  [PANEL_IDS.OPTIONS]: 'OPTIONS FLOW',
  [PANEL_IDS.INSIDERS]: 'INSIDER TRADES',
  [PANEL_IDS.CORRELATIONS]: 'CORRELATIONS',
  [PANEL_IDS.LIVE_STREAMS]: 'LIVE STREAMS',
  [PANEL_IDS.PREDICTION]: 'PREDICTION TRADING',
};

/** Maps panel IDs to i18n translation keys */
export const PANEL_NAME_KEYS: Record<string, TranslationKey> = {
  [PANEL_IDS.NEWS]: 'panelNewsFeed',
  [PANEL_IDS.MAP]: 'panelWorldMap',
  [PANEL_IDS.STOCKS]: 'panelMarketWatch',
  [PANEL_IDS.AI]: 'panelAiInsights',
  [PANEL_IDS.LOG]: 'panelTerminalLog',
  [PANEL_IDS.TRADING]: 'panelStockTrading',
  [PANEL_IDS.AI_CHAT]: 'panelAiChat',
  [PANEL_IDS.ECON_CALENDAR]: 'panelEconCalendar',
  [PANEL_IDS.ALERTS]: 'panelAlerts',
  [PANEL_IDS.SENTIMENT]: 'panelSentiment',
  [PANEL_IDS.RISK]: 'panelRiskCalc',
  [PANEL_IDS.SECTORS]: 'panelSectorRotation',
  [PANEL_IDS.EARNINGS]: 'panelEarningsCalendar',
  [PANEL_IDS.OPTIONS]: 'panelOptionsFlow',
  [PANEL_IDS.INSIDERS]: 'panelInsiderTrades',
  [PANEL_IDS.CORRELATIONS]: 'panelCorrelations',
  [PANEL_IDS.LIVE_STREAMS]: 'panelLiveStreams',
  [PANEL_IDS.PREDICTION]: 'panelPredictionTrading',
};

/** Get localized panel name (non-hook, reads locale from store directly) */
export function getLocalizedPanelName(panelId: string): string {
  const locale = useAppStore.getState().locale;
  const key = PANEL_NAME_KEYS[panelId];
  if (key) {
    return translations[locale]?.[key] ?? translations.en[key];
  }
  return PANEL_NAMES[panelId] || panelId;
}

export const ALL_PANEL_IDS = Object.values(PANEL_IDS);

/** Panel IDs that exist in the DEFAULT_LAYOUT (core panels shown on first load) */
const DEFAULT_PANEL_IDS: Set<string> = new Set([
  PANEL_IDS.NEWS, PANEL_IDS.MAP, PANEL_IDS.STOCKS,
  PANEL_IDS.AI, PANEL_IDS.LOG, PANEL_IDS.TRADING,
  PANEL_IDS.PREDICTION, PANEL_IDS.LIVE_STREAMS,
  PANEL_IDS.ECON_CALENDAR, PANEL_IDS.INSIDERS,
]);

/*
 * Professional layout (root row = horizontal, nested row = vertical):
 *
 * +--- 20% ---+---------- 50% ----------+------- 30% -------+
 * |           |                          | MARKET WATCH (tab) |
 * | NEWS FEED |                          | AI INSIGHTS  (tab) |
 * | (65%)     |        WORLD MAP         | AI CHAT      (tab) |
 * |           |         (70%)            | (55%)              |
 * +-----------+                          +--------------------+
 * | LIVE      +--------------------------+ TRADING            |
 * | STREAMS   |     TERMINAL LOG (30%)   | (45%)              |
 * | (35%)     |                          |                    |
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
      // Left column: News Feed on top, Live Streams on bottom (L1 vertical)
      {
        type: 'row',
        weight: 20,
        children: [
          {
            type: 'tabset',
            weight: 65,
            children: [
              { type: 'tab', name: 'NEWS FEED', component: PANEL_IDS.NEWS, id: PANEL_IDS.NEWS },
              { type: 'tab', name: 'ECONOMIC CALENDAR', component: PANEL_IDS.ECON_CALENDAR, id: PANEL_IDS.ECON_CALENDAR },
            ],
          },
          {
            type: 'tabset',
            weight: 35,
            children: [
              { type: 'tab', name: 'LIVE STREAMS', component: PANEL_IDS.LIVE_STREAMS, id: PANEL_IDS.LIVE_STREAMS },
            ],
          },
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
              { type: 'tab', name: 'INSIDER TRADES', component: PANEL_IDS.INSIDERS, id: PANEL_IDS.INSIDERS },
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
            selected: 0, // Default to MARKET WATCH
            children: [
              { type: 'tab', name: 'MARKET WATCH', component: PANEL_IDS.STOCKS, id: PANEL_IDS.STOCKS },
              { type: 'tab', name: 'AI INSIGHTS', component: PANEL_IDS.AI, id: PANEL_IDS.AI },
            ],
          },
          {
            type: 'tabset',
            weight: 45,
            children: [
              { type: 'tab', name: 'STOCK TRADING', component: PANEL_IDS.TRADING, id: PANEL_IDS.TRADING },
              { type: 'tab', name: 'PREDICTION TRADING', component: PANEL_IDS.PREDICTION, id: PANEL_IDS.PREDICTION },
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
    localStorage.setItem(LAYOUT_VERSION_KEY, String(LAYOUT_VERSION));
    const hiddenPanels = useAppStore.getState().hiddenPanels;
    return Model.fromJson(buildLayout(hiddenPanels));
  }

  // Force reset when layout version changes (e.g. new panels added)
  const savedVersion = parseInt(localStorage.getItem(LAYOUT_VERSION_KEY) || '0', 10);
  if (savedVersion < LAYOUT_VERSION) {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.setItem(LAYOUT_VERSION_KEY, String(LAYOUT_VERSION));
    // New panels not in DEFAULT_LAYOUT start hidden
    const nonDefaultPanels = ALL_PANEL_IDS.filter(id => !DEFAULT_PANEL_IDS.has(id));
    useAppStore.setState({ hiddenPanels: nonDefaultPanels });
    return Model.fromJson(buildLayout(nonDefaultPanels));
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
 * Show a panel: if it exists in the model, select it; otherwise add it dynamically.
 * For panels in DEFAULT_LAYOUT, falls back to rebuild + reload.
 */
export function showPanelInLayout(panelId: string) {
  const model = _modelRef;
  if (!model) {
    localStorage.setItem(RESET_FLAG, '1');
    window.location.reload();
    return;
  }

  // If panel already exists in model, just select it
  const existingNode = model.getNodeById(panelId);
  if (existingNode) {
    model.doAction(Actions.selectTab(panelId));
    return;
  }

  // For default panels that were pruned, rebuild from DEFAULT_LAYOUT
  if (DEFAULT_PANEL_IDS.has(panelId)) {
    localStorage.setItem(RESET_FLAG, '1');
    window.location.reload();
    return;
  }

  // Dynamically add the panel as a new tab in the active tabset
  const activeTabset = model.getActiveTabset();
  if (activeTabset) {
    model.doAction(Actions.addNode(
      { type: 'tab', name: getLocalizedPanelName(panelId), component: panelId, id: panelId },
      activeTabset.getId(),
      DockLocation.CENTER,
      -1,
    ));
  }
}

/**
 * Hide a panel: remove its tab from the model.
 */
export function hidePanelInLayout(panelId: string) {
  const model = _modelRef;
  if (!model) return;
  const node = model.getNodeById(panelId);
  if (node) {
    model.doAction(Actions.deleteTab(panelId));
  }
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
    let content: React.ReactNode;
    switch (component) {
      case PANEL_IDS.NEWS: content = <NewsFeed />; break;
      case PANEL_IDS.MAP: content = <LazyWrap><WorldMapPanel /></LazyWrap>; break;
      case PANEL_IDS.STOCKS: content = <StockPanel />; break;
      case PANEL_IDS.AI: content = <AiInsights />; break;
      case PANEL_IDS.LOG: content = <TerminalLog />; break;
      case PANEL_IDS.TRADING: content = <LazyWrap><TradingPanel /></LazyWrap>; break;
      case PANEL_IDS.AI_CHAT: content = <div className="flex items-center justify-center h-full text-neutral/30 text-[10px] font-mono uppercase tracking-widest">Coming soon</div>; break;
      case PANEL_IDS.ECON_CALENDAR: content = <LazyWrap><EconomicCalendarPanel /></LazyWrap>; break;
      case PANEL_IDS.ALERTS: content = <LazyWrap><AlertsPanel /></LazyWrap>; break;
      case PANEL_IDS.SENTIMENT: content = <LazyWrap><SentimentPanel /></LazyWrap>; break;
      case PANEL_IDS.RISK: content = <LazyWrap><RiskCalculator /></LazyWrap>; break;
      case PANEL_IDS.SECTORS: content = <LazyWrap><SectorRotationPanel /></LazyWrap>; break;
      case PANEL_IDS.EARNINGS: content = <LazyWrap><EarningsCalendarPanel /></LazyWrap>; break;
      case PANEL_IDS.OPTIONS: content = <LazyWrap><OptionsFlowPanel /></LazyWrap>; break;
      case PANEL_IDS.INSIDERS: content = <LazyWrap><InsiderTradesPanel /></LazyWrap>; break;
      case PANEL_IDS.CORRELATIONS: content = <LazyWrap><CorrelationMatrixPanel /></LazyWrap>; break;
      case PANEL_IDS.LIVE_STREAMS: content = <LazyWrap><LiveStreamsPanel /></LazyWrap>; break;
      case PANEL_IDS.PREDICTION: content = <LazyWrap><PredictionTradingPanel /></LazyWrap>; break;
      default: {
        const extra = extraFactories.get(component ?? '');
        if (extra) return <PanelErrorBoundary>{extra(node)}</PanelErrorBoundary>;
        return <div className="flex items-center justify-center h-full text-neutral text-xs font-mono uppercase">Unknown panel: {component}</div>;
      }
    }
    return <PanelErrorBoundary>{content}</PanelErrorBoundary>;
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
  const nonDefaultPanels = ALL_PANEL_IDS.filter(id => !DEFAULT_PANEL_IDS.has(id));
  useAppStore.setState({ hiddenPanels: nonDefaultPanels });
  window.location.reload();
}
