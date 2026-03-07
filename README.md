# TradingNewsWeb

A real-time trading news terminal with AI-powered analysis, prediction markets, and multi-asset trading — all in a Bloomberg-style dashboard.

[![Discord](https://img.shields.io/discord/YOUR_SERVER_ID?color=5865F2&logo=discord&logoColor=white&label=Discord)](https://discord.gg/6dr83qcJ)
[![License: BSL 1.1](https://img.shields.io/badge/License-BSL_1.1-yellow.svg)](LICENSE)

**[Live Demo](https://terminal.tradingnews.press)** · **[Discord](https://discord.gg/6dr83qcJ)**

## Features

- **Live News Feed** — Auto-scrapes trading news with sentiment badges, category filters (finance/world/business/politics), and keyword search
- **AI Analysis** — Sentiment extraction, geo-location, and conflict detection for every article
- **Prediction Markets** — Polymarket integration with orderbook, sparkline charts, and wallet-based trading
- **Stock Trading** — Alpaca paper/live trading and Hyperliquid perpetual contracts (49 stock perps)
- **Interactive Charts** — Multi-chart panel with TradingView lightweight-charts, technical indicators (RSI, MACD, Bollinger, ATR, VWAP), and drawing tools
- **World Map** — News events plotted by location, conflict zone heatmap, and live stock exchange markers
- **Market Heatmap** — Visual treemap of tracked stock performance
- **Economic Calendar** — Real-time events from Forex Factory with release detection
- **Options Flow** — Unusual options activity detection from Yahoo Finance
- **Insider Trading** — SEC EDGAR Form 4 tracking with cluster buy detection
- **Risk Calculator** — Position sizer, Kelly criterion, max drawdown analyzer
- **Sector Rotation** — 11 GICS sector ETF momentum analysis
- **AI Chat** — Context-aware financial assistant with article/chart attachments
- **6 Languages** — English, Español, Français, 日本語, 한국어, 中文
- **Web3 Wallet** — RainbowKit + wagmi for Polygon/Arbitrum/Mainnet
- **Auth & Billing** — Google OAuth, email verification, Stripe Pro subscription

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4 |
| Backend | Express 5, TypeScript, Prisma (SQLite) |
| AI | OpenAI-compatible API (Gemini, GPT, local models) |
| Real-time | WebSocket (ws) on shared HTTP server |
| Charts | lightweight-charts, MapLibre GL |
| Web3 | wagmi, viem, RainbowKit |
| Payments | Stripe (Checkout + Customer Portal) |
| UI Layout | FlexLayout React |
| Deployment | Docker → Google Cloud Run |

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your API keys

# Initialize database
cd server && npx prisma migrate dev && cd ..

# Start development
npm run dev
```

Frontend runs on `http://localhost:5174`, backend on `http://localhost:3001`.

See [.env.example](.env.example) for all configuration options.

## Project Structure

```
TradingNewsWeb/
├── client/                 # React frontend (Vite)
│   └── src/
│       ├── api/hooks/      # React Query data hooks
│       ├── components/
│       │   ├── common/     # Badges, notifications, settings
│       │   ├── layout/     # App shell, dock layout, top bar
│       │   ├── panels/     # News, charts, map, calendar, etc.
│       │   └── trading/    # Orderbook, trade form, Polymarket
│       ├── i18n/           # 6-language translations
│       ├── realtime/       # WebSocket hook
│       └── stores/         # Zustand state management
├── server/                 # Express backend
│   ├── prisma/             # Schema + migrations (SQLite)
│   └── src/
│       ├── config/         # Environment validation (Zod)
│       ├── middleware/      # Auth, rate limiting
│       ├── routes/         # REST API endpoints
│       └── services/
│           ├── ai/         # Analysis pipeline + clustering
│           ├── alerts/     # Price/news alert evaluator
│           ├── calendar/   # Economic calendar tracker
│           ├── scraper/    # News scraper + scheduler
│           ├── stocks/     # Yahoo Finance, insider, correlation
│           └── websocket/  # WS server
├── Dockerfile              # Multi-stage production build
└── LICENSE                 # BSL 1.1
```

## Deployment

```bash
# Build container image
gcloud builds submit --tag gcr.io/PROJECT_ID/tradingnewsweb

# Deploy to Cloud Run
gcloud run deploy tradingnewsweb \
  --image gcr.io/PROJECT_ID/tradingnewsweb \
  --platform managed --region us-central1 \
  --allow-unauthenticated --port 3001 \
  --memory 1Gi --cpu 1 \
  --min-instances 1 --max-instances 3
```

Environment variables are injected via Cloud Run configuration (not baked into the image).

## Community

- **Discord** — [discord.gg/6dr83qcJ](https://discord.gg/6dr83qcJ)
- **Issues** — [GitHub Issues](https://github.com/KoNananachan/TradingNewsWeb/issues)

## License

This project is licensed under the [Business Source License 1.1](LICENSE).

You may view, fork, and modify the code for non-commercial purposes. Commercial use requires a separate license. See [LICENSE](LICENSE) for details.
