# Changelog

All notable changes to this project will be documented in this file.

## [0.11.0] - 2026-03-06

### Changed
- **News categories:** switched from AI-generated categories (10) to API-provided categories (finance, world, business, politics)
- **AI analysis:** removed category classification from AI prompt; AI now only handles sentiment, location, and conflict detection
- **Conflict detection:** AI flags articles as `isConflict` (war, armed conflict, riots, terrorism) instead of relying on GDELT API + geopolitics category
- **Conflict map:** shows AI-flagged conflict points from last 3 days (was 7 days from geopolitics category + GDELT)
- Removed GDELT API dependency entirely — conflict data is now 100% from AI-analyzed articles
- Added `isConflict` field to NewsArticle schema with composite index on `(isConflict, scrapedAt)`
- Scraper now saves API category directly on article creation (no longer deferred to AI)
- Seed always runs on startup to ensure new categories exist

## [0.10.3] - 2026-03-06

### Changed
- GDELT conflict data: switched from dead v2/geo API to v2/doc PointData endpoint with non-JSON response guard
- Polymarket: market list shows full question instead of option name (groupItemTitle)
- Polymarket: server-side 30s response cache for market listings to reduce Gamma API calls
- Polymarket: `MarketCard` wrapped in `React.memo` to reduce list re-renders
- Stock panel: lazy-load `MarketHeatmap` and `MultiChart` for faster initial render
- Language selector: Chinese moved to last position
- Alpaca: added input validation (side, qty, notional) and sanitized error responses

## [0.10.1] - 2026-03-06

### Changed
- Polymarket: filter out resolved/settled markets (closed, inactive, or any outcome ≥ 99%) on both server and client
- Polymarket: sparkline uses 1-week history instead of all-time for faster load and more relevant trend
- Polymarket: "Connect Wallet" is now a clickable button that opens RainbowKit modal (was plain text)
- Polymarket: server-side filtering reduces payload size for market listings
- Removed unused `parseJsonArray` import from orderbook component

## [0.10.0] - 2026-03-04

### Added
- **Polymarket Prediction Trading:** Full prediction market integration via Polymarket
  - Browse markets by category (All, Politics, Crypto, Sports, Science, Culture)
  - Real-time orderbook with bid/ask depth visualization
  - Price sparkline charts with trend coloring (green/red)
  - Trade form with market/limit orders, outcome selection, and order summary
  - CLOB API proxy for order book, midpoint, price history, and order placement
  - EIP-712 wallet authentication for signed trading
  - User position tracking via CLOB data endpoint
- **Wallet Button in Top Bar:** Persistent wallet connection status visible across all panels
- **Polygon Chain Support:** Added Polygon network to wagmi config for Polymarket USDC transactions
- **6-language i18n:** Full translations for all prediction trading keys (EN, 中文, 日本語, 한국어, ES, FR)
- Renamed "Trading" panel to "Stock Trading" to distinguish from prediction trading

## [0.9.1] - 2026-03-04

### Added
- **Database indices:** 7 new indices on StockRecommendation, TrackedStock, AiAnalysisLog, TradeOrder, EconomicEvent for query performance
- **Accessibility:** `aria-label` on all top bar interactive buttons (panels, fullscreen, notifications, settings)
- **Symbol format validation** on batch name lookup endpoint (reject malformed symbols)

### Changed
- News feed `watchlistSymbols` memoized with `useMemo`; `scoreArticle` wrapped in `useCallback` to reduce re-renders
- WebSocket broadcast wrapped in try-catch to prevent one failed send from breaking the loop
- Sentiment trend query capped at 10,000 articles to prevent unbounded memory usage
- Scraper `knownIds` cache now properly evicts oldest entries when exceeding 50K cap
- Watchlist search errors return proper HTTP status (503 for timeout) instead of silent empty array
- Earnings calendar errors return 503 instead of silent empty array
- Indices fetch errors return 503 when no cache available instead of 200 with empty array
- 2FA verification code uses `crypto.randomInt()` for cryptographically secure generation

### Fixed
- CSS class typo in news detail back button: `hover:text-whitehover:` → `hover:text-white hover:`

## [0.9.0] - 2026-03-04

### Added
- **Complete French (fr) translations:** 76 missing stock panel, fundamentals, and financials keys
- **Loading spinners & RETRY buttons:** Sentiment, Options Flow, Insider Trades, Earnings Calendar, Correlation Matrix panels
- **Backend input validation:**
  - Days parameter clamping (1–365) on stock history endpoints
  - Max 100 symbols limit on batch name lookups
  - Symbol format validation on watchlist DELETE
  - Date format validation (YYYY-MM-DD) on calendar endpoint
  - Condition size limit (2000 chars) on alerts
- **Rate limiting:** `/api/scrape` endpoint limited to 1 request/minute
- **Yahoo Finance search timeout:** 10-second fetch timeout to prevent hanging requests

### Changed
- All `transition-none` → `transition-colors` across 13 frontend files for smooth hover effects
- AI chat send button shows `cursor-not-allowed` when disabled
- AI chat error messages now differentiate by status code (429 rate limit, 500+ service unavailable)
- Alpaca credential errors sanitized (no internal error leakage)
- Auth middleware logs categorized error codes/messages
- Added `.gcloudignore` to exclude `node_modules` and build artifacts from Cloud Build uploads

### Fixed
- Missing micro-interactions on interactive elements (buttons, tabs, filters)
- Silent cache upsert failures now logged for debugging
- Timeout errors properly detected and reported to users

## [0.8.0] - 2026-03-02

### Added
- **User Authentication:** Google OAuth + email verification code login
  - Session-based auth with httpOnly cookies (30-day expiry)
  - Login modal with terminal-style UI
  - User menu with plan info and logout
- **Stripe Billing:** $20/month Pro subscription
  - Checkout Session + Customer Portal integration
  - Webhook handling for subscription lifecycle events
  - Pro lock overlay on AI Chat and AI Insights panels
- **Hyperliquid Stock Perps:** Full support for xyz dex stock perpetual contracts
  - New `getStockPerpMetaAndCtxs()` API for xyz builder-deployed markets
  - Combined mid prices (allMids + stock perp markPx) for orderbook and trade form
  - 49 stock perps (AAPL, TSLA, NVDA, AMZN, GOOGL, MSFT, META, etc.) with S-PERP badge
- **Global Stock Exchange Markers on World Map:** Toggle-able HTML badge markers
  - 12 major exchanges (NYSE, NASDAQ, LSE, TSE, SSE, HKEX, etc.) with live index data
  - Click popup showing all indices for each exchange city
- **News Keyword Search:** Debounced search bar in news feed with i18n support
- **7 Additional Global Indices:** DAX, CAC 40, Shanghai Composite, Sensex, ASX 200, KOSPI, TSX
- **Alpaca Trading Channel:** Paper/live stock trading via Alpaca API
- **i18n System:** 6 languages (EN, 中文, 日本語, 한국어, Español, Français)
- **New User Onboarding Tooltip:** Panel discovery prompt on first visit
- **Live Streams as Default Panel:** Placed in left-bottom tabset

### Changed
- Economic Calendar and Insider Trades now appear as independent draggable tabs alongside News Feed and World Map (layout version 7)
- Conflicts data: lowered MIN_COUNT from 200 to 15, extended timespan from 3d to 7d, increased maxpoints to 1000
- API client sends credentials for cookie-based auth
- CORS configured with `credentials: true`

### Fixed
- Conflicts panel showing very few data points due to overly restrictive GDELT filters
- Conflicts cache pre-warming on server startup for instant first load

## [0.7.0] - 2026-03-01

### Added
- **Economic Calendar (F1):** Real-time economic event tracking via Forex Factory
  - 15-minute polling with automatic release detection
  - WebSocket broadcast on data release (`calendar-release` message type)
  - Country and impact level filtering (US, EU, JP, GB, CN)
  - Upcoming events view with countdown
- **Price/News Alert System (F2):** Configurable alerts with 5 trigger types
  - Price Cross, Price Change %, Sentiment Shift, News Keyword, Volume Spike
  - Real-time evaluation after each quote refresh
  - WebSocket notification on trigger (`alert-triggered` message type)
  - Full CRUD management panel
- **Advanced Technical Indicators (F3):** 6 indicators + drawing tools
  - RSI(14), MACD(12,26,9), Bollinger Bands(20,2), ATR(14), VWAP
  - Drawing tools: Trend Line, Fibonacci Retracement, Horizontal Line
  - Separate sub-charts for RSI/MACD with synchronized time axes
  - Standalone StockChart component with IndicatorToolbar
- **News Clustering (F4):** Automatic article grouping with impact scoring
  - Union-Find algorithm with multi-factor similarity (tickers, category, time, keywords)
  - Impact score 1-10 based on article count, sentiment, tickers, category weight
  - ARTICLES | CLUSTERS toggle view in news feed
- **Sentiment Trend (F5):** Historical sentiment visualization
  - Scope by ticker, category, or market-wide
  - Time windows: 1D (hourly), 1W (daily), 1M (daily)
  - Automatic reversal detection (zero-crossing or >0.3 change)
- **Risk Calculator (F6):** 5-tab professional risk management tool
  - Position Sizer, Risk/Reward visualizer, ATR Stop suggestion
  - Kelly Criterion calculator, Max Drawdown analyzer
- **Sector Rotation (F7):** 11 GICS sector ETF analysis
  - Performance heatmap with period selection (1D/1W/1M/3M)
  - Rotation scatter plot (momentum vs acceleration quadrants)
- **Earnings Calendar (F8):** Upcoming earnings for tracked stocks
  - EPS estimate vs actual comparison with beat/miss highlighting
  - Group by date with 7/14/30 day filter
- **Options Flow (F9):** Unusual options activity detection
  - Yahoo Finance options chain analysis
  - Anomaly detection: Volume > 5×OI, Volume > 10K, Premium > $100K
- **Insider Trading (F10):** SEC EDGAR Form 4 tracking
  - 30-minute polling for tracked stocks
  - Cluster Buy detection (2+ executives buying within 7 days)
- **Cross-Asset Correlation Matrix (F12):** 8×8 Pearson correlation
  - Assets: S&P 500, NASDAQ, Gold, Oil, Bitcoin, DXY, 10Y Treasury, VIX
  - Period selection: 1M/3M/6M/1Y with color-coded matrix
- **Personalized News Feed (F13):** Relevance-based article ranking
  - Scoring: watchlist ticker match (×10), category preference (×2), freshness (×5), sentiment intensity (×3)
  - ALL | FOR YOU toggle in news feed header
- **Data Retention (F14):** Automatic data lifecycle management
  - 30-day article retention with sentiment archiving
  - 7-day scrape run cleanup
  - Daily sentiment aggregate archiving before deletion
- **AI Chat Context Enhancement (F15):** Rich context attachments
  - Attach articles, charts, or portfolio holdings to chat
  - "Ask AI" button on stock chart panel
  - Server-side context resolution for deeper analysis
- **Live Streams Panel:** Embedded YouTube livestreams for financial news
  - 8 channels: Bloomberg, CNBC, Fox Business, Yahoo Finance, CNN, Sky News, Al Jazeera, DW News
  - One-click channel switching with auto-play
- 10 new dock panels (hidden by default, accessible via panel menu)
- 7 new Prisma models (EconomicEvent, Alert, AlertTrigger, NewsCluster, NewsClusterArticle, InsiderTrade, SentimentArchive)
- ~120 new i18n translation keys across 6 languages
- 2 new WebSocket message types (calendar-release, alert-triggered)

### Changed
- Layout version bumped to 5 (triggers layout reset for new panels)
- Stock tracker now evaluates alerts after each quote refresh
- AI chat hook accepts optional context parameter
- News feed supports cluster view mode

### Fixed
- **AI Chat SSE hang:** `req.on('close')` fired immediately after POST body consumed; changed to `res.on('close')` for correct client disconnect detection
- **Yahoo Finance v6 API 404:** Migrated all quote endpoints from deprecated v6 to v7 with crumb authentication, restoring full quote data including earningsDate, EPS, and extended fields
- **Options Flow empty:** Added Yahoo crumb authentication to options chain API (v7 now requires it)
- **Economic Calendar empty:** Replaced FMP API (free tier returns no calendar data) with Forex Factory JSON feed
- **Conflict zones empty:** Added database fallback when GDELT API is unreachable; expanded city name matching (Riyadh, Tel Aviv, Ankara, Cairo, Doha, etc.) and widened time window to 7 days
- **Earnings Calendar empty:** `getQuotes()` batch response now includes earningsDate/eps/epsForward fields

## [0.6.0] - 2026-02-28

### Added
- Conflict zones layer on world map (GDELT GEO API, no auth required)
  - Heatmap + point markers for active conflict regions
  - Whitelist filter covering Middle East, Africa, Eastern Europe, South Asia, Americas
  - Click popup showing location, mention count, source article link
  - Toggle button in map header to show/hide conflict layer
- Stock panel: Profile & Financials tabs (Bloomberg-style layout)
  - Company info (sector, industry, employees, HQ, website)
  - Analyst targets (mean/high/low price, recommendation)
  - Financials breakdown (revenue, margins, cash flow, debt ratios)
- Stock chart: range selector (1D/5D/1M/3M/6M/1Y/ALL)
- Stock chart: volume histogram overlay (bottom 20%)
- Stock chart: SMA20 and SMA50 moving average lines
- Extended stock quote fields (beta, forwardPE, sharesOutstanding, bookValue, etc.)
- Yahoo Finance: profile and financials data fetching
- `/api/conflicts` endpoint for conflict zone data

### Fixed
- News detail TRADE button not navigating to trading panel (drawer was blocking view)
- AI chat client timeout too short (90s → 150s to allow server-side retries)

### Changed
- Chat route: added retry logic (2 attempts) and diagnostic logging
- AI prompts and news analyzer improvements
- WebSocket reconnect stability improvements

## [0.5.0] - 2025-02-27

### Added
- AI Chat panel with SSE streaming and markdown rendering
- Extended stock stats and improved geo-location accuracy

### Fixed
- Category ordering, AI chat timeout, fullscreen mode
- Trading panel USDH/USDC handling
- Use publishedAt instead of scrapedAt for news timestamps in AI chat

## [0.4.0] - 2025-02-27

### Added
- Database persistence across Cloud Run deployments via GCS backup/restore
- Periodic database backup to Google Cloud Storage (every 5 minutes)
- Automatic database restore from GCS on instance startup

### Fixed
- World map missing dots: AI geo-location coordinates lost due to `|| null` falsy bug (now `?? null`)
- AI prompt improved to more aggressively extract location data for news articles

## [0.3.0] - 2025-02-27

### Added
- Multi-language UI support (English, 中文, 日本語, 한국어, Español, Français)
- Language selector in Settings panel (persisted in localStorage)
- All Hyperliquid perpetual contracts shown in trading market list (previously only BTC/ETH)
- Auto-seed database on server startup (categories + default tracked stocks)
- Text-based WebSocket heartbeat to prevent browser client timeout
- `DEPLOY.md` deployment workflow reference

### Changed
- Scraper `FETCH_LIMIT` increased from 10 to 100 for faster initial data population
- Renamed top-bar branding from "Bloomberg" to "TradingNewsTerminal"

### Fixed
- WebSocket connect/disconnect loop caused by missing browser-visible heartbeat
- AI analysis foreign key errors due to missing categories (no seed on fresh DB)
- Empty watchlist and map on production (no default data)

## [0.2.0] - 2025-02-27

### Added
- Cloud Run deployment support (Dockerfile, `.dockerignore`)
- WebSocket merged onto HTTP server at `/ws` path (single-port architecture)
- Static file serving + SPA fallback in Express for production
- `build` and `start` scripts in root and server `package.json`
- Dynamic WebSocket URL on client (auto-detects `ws://` vs `wss://`)
- README with project overview, tech stack, and deployment guide

### Changed
- Default `PORT` from 3001 to 8080 (Cloud Run standard)
- `DATABASE_URL` now has a default value for production
- Vite WS proxy target updated from `:3002` to `:3001`

## [0.1.0] - 2025-02-26

### Added
- Initial project setup with npm workspaces (client + server)
- News scraper pulling from TradingNews API
- AI analysis pipeline (Gemini) for sentiment, categories, geo-location, and stock recommendations
- Real-time WebSocket push for news, quotes, and trading signals
- Bloomberg-style dashboard with dockable FlexLayout panels
- News feed with sentiment badges and category filters
- Multi-chart panel (TradingView lightweight-charts)
- World map with geo-located news events (MapLibre GL)
- Market heatmap for tracked stocks
- Stock tracker with Yahoo Finance live quotes
- Trading panel with Hyperliquid integration (demo orders)
- Web3 wallet connection (RainbowKit + wagmi)
- Command palette, keyboard shortcuts, notification system
- Audit dashboard for scrape runs and AI analysis logs
- SQLite database with Prisma ORM
