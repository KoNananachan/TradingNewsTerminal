# TradingNewsWeb

A real-time trading news terminal that scrapes financial news, enriches articles with AI-powered sentiment analysis and stock recommendations, and presents everything in a Bloomberg-style dashboard.

## Features

- **Live News Feed** — Auto-scrapes trading news and displays articles with sentiment tags and category filters
- **AI Analysis** — Gemini-powered pipeline that extracts sentiment (bullish/bearish/neutral), geo-location, category, and actionable stock recommendations from each article
- **Real-time Updates** — WebSocket push for breaking news, quote refreshes, and new trading signals
- **Interactive Charts** — Multi-chart panel with TradingView lightweight-charts
- **World Map** — MapLibre GL map plotting news events by geographic location
- **Market Heatmap** — Visual overview of tracked stock performance
- **Trading Panel** — Demo order form with Hyperliquid integration (market/limit orders, leverage)
- **Stock Tracker** — Live quotes via Yahoo Finance with sparkline charts and watchlist management
- **Web3 Wallet** — RainbowKit + wagmi for wallet connection and session tracking
- **Dockable Layout** — Drag-and-drop panel arrangement powered by FlexLayout

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4 |
| Backend | Express 5, TypeScript, Prisma (SQLite) |
| AI | OpenAI SDK → Gemini API (configurable base URL) |
| Real-time | WebSocket (ws) on shared HTTP server |
| Charts | lightweight-charts, MapLibre GL |
| Web3 | wagmi, viem, RainbowKit |
| UI Layout | FlexLayout React |
| Deployment | Docker multi-stage build → Google Cloud Run |

## Project Structure

```
TradingNewsWeb/
├── client/                 # React frontend (Vite)
│   └── src/
│       ├── api/hooks/      # React Query data hooks
│       ├── components/
│       │   ├── common/     # Badges, notifications, command palette
│       │   ├── layout/     # App shell, dock layout, status bar, ticker
│       │   ├── panels/     # News feed, charts, map, heatmap, trading
│       │   └── trading/    # Orderbook, trade form, portfolio
│       ├── realtime/       # WebSocket hook
│       └── stores/         # Zustand state management
├── server/                 # Express backend
│   ├── prisma/             # Schema + migrations (SQLite)
│   └── src/
│       ├── config/         # Environment validation (Zod)
│       ├── routes/         # REST API endpoints
│       └── services/
│           ├── ai/         # Gemini analysis pipeline
│           ├── scraper/    # News scraper + scheduler
│           ├── stocks/     # Yahoo Finance tracker
│           └── websocket/  # WS server (attached to HTTP)
├── Dockerfile              # Multi-stage production build
└── .dockerignore
```

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+

### Setup

```bash
# Install dependencies
npm install

# Initialize the database
npm run db:migrate
npm run db:seed

# Create .env in project root
cat > .env << 'EOF'
DATABASE_URL="file:./server/prisma/dev.db"
GEMINI_API_KEY="your-api-key"
GEMINI_BASE_URL="https://generativelanguage.googleapis.com/v1beta"
GEMINI_MODEL="gemini-2.0-flash"
PORT=3001
WS_PORT=3002
SCRAPE_INTERVAL_MINUTES=10
EOF
```

### Development

```bash
npm run dev
```

This starts both the backend (port 3001) and frontend dev server (port 5174) concurrently. The Vite dev server proxies `/api` and `/ws` to the backend.

### Production Build

```bash
npm run build    # Builds client + server
npm run start    # Runs compiled server (serves client static files)
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/news` | List news articles (with pagination & filters) |
| GET | `/api/stocks` | Get tracked stock quotes |
| GET | `/api/recommendations` | Get AI stock recommendations |
| GET | `/api/categories` | List news categories |
| GET | `/api/map-events` | Get geo-located news for world map |
| GET/POST | `/api/watchlist` | Manage stock watchlist |
| GET | `/api/audit` | View scrape runs and AI analysis logs |
| POST | `/api/scrape` | Manually trigger a news scrape |
| GET | `/api/health` | Health check |
| WS | `/ws` | Real-time updates (news, quotes, recommendations) |

## Deployment (Google Cloud Run)

The project includes a multi-stage Dockerfile optimized for Cloud Run:

```bash
# Build and submit container image
gcloud builds submit --tag gcr.io/PROJECT_ID/tradingnewsweb

# Deploy
gcloud run deploy tradingnewsweb \
  --image gcr.io/PROJECT_ID/tradingnewsweb \
  --platform managed --region us-central1 \
  --allow-unauthenticated --port 8080 \
  --set-env-vars "DATABASE_URL=file:./prisma/prod.db,GEMINI_API_KEY=your-key" \
  --memory 512Mi --cpu 1 \
  --min-instances 1 --max-instances 3 \
  --timeout 3600 --session-affinity
```

Key deployment notes:
- WebSocket and HTTP share a single port (8080)
- SQLite is ephemeral — data resets on instance restart
- `min-instances 1` keeps the scraper running continuously
- `session-affinity` routes the same client to the same instance for WebSocket stability

## License

Private project.
