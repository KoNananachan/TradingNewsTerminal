# Changelog

All notable changes to this project will be documented in this file.

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
