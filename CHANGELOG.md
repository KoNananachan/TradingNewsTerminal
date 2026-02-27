# Changelog

All notable changes to this project will be documented in this file.

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
