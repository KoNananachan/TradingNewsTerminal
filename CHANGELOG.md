# Changelog

All notable changes to this project will be documented in this file.

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
