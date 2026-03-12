# CLAUDE.md - Project Standards & Development Rules

> This file is the single source of truth for all development, security, and compliance standards.
> Every code change, optimization, and deployment MUST follow these rules.

---

## Project Identity

- **Name**: Neuberg
- **Repo**: github.com/KoNananachan/Neuberg
- **License**: BSL 1.1 (perpetual, non-commercial)
- **Licensor**: Bauhinia AI Limited
- **Production URL**: https://neuberg.ai
- **GCP Project**: tradingnewsterminal (us-central1)

---

## Hard Rules (Never Break)

### Language & Localization
- **No Chinese text in any git-committed code or markdown** (README, CHANGELOG, comments, etc.)
- Exception: `client/src/i18n/translations.ts` zh locale translations are expected
- All user-facing strings must go through i18n system
- Code comments, commit messages, and documentation in English only

### Secrets & Credentials
- **NEVER hardcode API keys, tokens, passwords, or secrets in code**
- All secrets go in environment variables (validated via `server/src/config/env.ts` Zod schema)
- `.env` is gitignored; only `.env.example` with empty placeholder values is committed
- Sensitive credentials (Alpaca API keys) must be encrypted at rest (AES-256-GCM via `server/src/lib/crypto.ts`)
- `ENCRYPTION_KEY` must be set in production; app should validate at startup
- Before every commit: grep for patterns like `sk_`, `pk_`, `AIza`, `ya29.`, real email addresses

### Authentication & Authorization
- All data-mutating endpoints MUST use `requireAuth` middleware
- All user-specific data endpoints MUST verify ownership (user can only access own data)
- Session cookies: `httpOnly: true`, `sameSite: 'lax'`, `secure: true` in production
- Brute-force protection on auth endpoints (rate limiting + attempt tracking)

### XSS Prevention
- **NEVER use `innerHTML`, `setHTML()`, or `dangerouslySetInnerHTML` with dynamic data**
- Use `document.createElement()` + `textContent` for DOM manipulation
- Use `setDOMContent()` instead of `setHTML()` for MapLibre popups
- All API data rendered in the UI must be treated as untrusted

### Data Persistence
- `GCS_BUCKET` must be configured in production for SQLite backup
- Backup runs every 5 minutes during operation
- Final backup runs on graceful shutdown (SIGTERM)
- Startup restores from GCS before `prisma db push`
- Schema changes must be backward-compatible (no data loss on migration)

### Deployment
- Build: `gcloud builds submit --tag gcr.io/tradingnewsterminal/tradingnewsweb:vX.Y.Z`
- Deploy via Cloud Run REST API (gcloud run deploy broken with Python 3.9)
- Use `CLOUDSDK_PYTHON=/usr/bin/python3` prefix for all gcloud commands
- Always verify health check after deploy: `curl https://neuberg.ai/api/health`
- Never bake secrets into Docker image; inject via Cloud Run env vars

---

## Security Standards

### Server-Side
- All routes under `/api/auth`, `/api/alpaca`, `/api/audit`, `/api/recommendations` require authentication
- Billing routes exist but are currently disabled in the UI (no Pro subscription required)
- Rate limiting: global 120/min, auth 10/15min, chat 10/min
- Input validation with Zod schemas on all POST/PUT endpoints
- Pagination limits on all list endpoints (max 200-500)
- Error responses: return generic messages to client, log details server-side only
- Never expose upstream API error bodies to client (e.g., Polymarket, Alpaca)
- Billing redirect URLs (when re-enabled): validate against `ALLOWED_ORIGINS` whitelist
- YouTube handle validation: strict regex `/^@[a-zA-Z0-9_-]{1,50}$/`

### Client-Side
- No secrets in localStorage/sessionStorage
- No `eval()`, `Function()`, or dynamic code execution
- Validate redirect URLs before `window.location.href` assignment
- Alpaca credentials: clear from state immediately after submission

### Dependencies
- Run `npm audit` before every release
- Address all HIGH/CRITICAL vulnerabilities before deploy
- Keep `express-rate-limit` >= 8.2.2 (IPv6 bypass fix)

---

## Architecture Conventions

### News Pipeline
- News API provides category field (finance/world/business/politics)
- AI does NOT classify categories; AI handles: sentiment + location + isConflict (single prompt)
- `isConflict: true` = SPECIFIC VIOLENT EVENT already happened or actively happening, with casualties. Must describe a concrete attack/battle/incident, not a general situation.
- TRUE: airstrikes killing people, bombings, armed battles, terrorist attacks with casualties
- NOT conflict: missile tests, military drills, troop deployments, ship tracking, sanctions, threats, protests, arms deals, defense spending, cyber attacks, trade wars, economic impact of war, peace talks, military buildup
- Litmus test: Were weapons fired AT people and did casualties occur? If not, isConflict = false.
- Conflict map shows last 24h of `isConflict: true` articles with lat/lng

### API Categories
- Only 4 categories: `finance`, `world`, `business`, `politics`
- Validated via `KNOWN_CATEGORIES` Set before saving
- Unknown categories from API are saved as `categorySlug: null`

### Database
- SQLite via Prisma (single file: `prod.db`)
- Schema changes via Prisma migrations
- Data retention: articles/scrape-runs deleted after 7 days (sentiment archived)
- User sessions cleaned hourly (expired sessions + verification codes)

### File Structure
```
server/src/
  config/env.ts        - Environment validation (Zod)
  lib/                 - Shared utilities (prisma, crypto, gcs-backup, seed)
  middleware/auth.ts    - attachUser, requireAuth (requirePro exists but unused)
  routes/              - Express route handlers
  services/            - Business logic (scraper, stocks, calendar, alerts)
                         services/ai/ is gitignored (proprietary, not open source)
  scripts/             - One-off scripts (restore-db)

client/src/
  api/hooks/           - React Query data hooks
  components/          - UI (common, layout, panels, trading, auth)
  i18n/                - 6-language translations
  stores/              - Zustand state management
  lib/                 - Hyperliquid, Polymarket, indicators, wagmi config
```

---

## Code Quality Rules

### TypeScript
- `strict: true` in both client and server tsconfigs
- Avoid `any` type; use proper interfaces or `unknown` + type guards
- No `// @ts-ignore` or `// @ts-expect-error` without explanation

### Error Handling
- Consistent error response format: `{ error: string }`
- HTTP status codes: 400 (validation), 401 (auth), 403 (forbidden), 404 (not found), 429 (rate limit), 500 (server error), 502 (upstream failure)
- All route handlers wrapped in try/catch
- Log errors with `[Module]` prefix: `console.error('[Auth] Error:', err?.message)`

### Naming
- Routes: kebab-case URLs (`/api/map-events`, `/api/ai-logs`)
- Files: kebab-case (`world-map-panel.tsx`, `news-analyzer.ts`)
- Functions/variables: camelCase
- Types/interfaces: PascalCase
- Constants: UPPER_SNAKE_CASE

### Commits
- Prefix: `feat:`, `fix:`, `security:`, `chore:`, `refactor:`
- Author: `KoNananachan <KoNananachan@users.noreply.github.com>`
- Co-author line for AI-assisted commits

---

## Compliance Requirements (TODO)

### Must Implement Before Public Launch
- [ ] Privacy Policy (PRIVACY_POLICY.md + link in app footer)
- [ ] Terms of Service (TERMS_OF_SERVICE.md + link in app footer)
- [ ] Account deletion endpoint (DELETE /api/auth/me)
- [ ] User data export endpoint (GET /api/auth/me/export)
- [ ] Cookie consent banner on first visit
- [ ] Consent checkboxes at signup (ToS + Privacy + financial disclaimer)
- [ ] Prominent investment disclaimer modal on first login

### Should Implement
- [ ] .github/ folder (issue templates, PR template, CONTRIBUTING.md, CODE_OF_CONDUCT.md)
- [ ] GitHub Actions CI (test, lint, security scan)
- [ ] API documentation (OpenAPI spec or markdown)
- [ ] Structured logging (replace console.log with JSON logger)
- [ ] Unit/integration tests (target 60% server coverage)
- [ ] Copyright headers in source files
- [ ] ACKNOWLEDGMENTS.md for open source dependencies

---

## Git & GitHub Rules

### Before Every Commit
1. `npx tsc --noEmit` passes on both client and server
2. No Chinese text in committed files (except i18n translations)
3. No secrets, API keys, or personal data in diff
4. No `.env`, `.db`, or build artifacts in staging

### Before Every Deploy
1. All security fixes committed and pushed
2. `npm audit` shows no HIGH/CRITICAL
3. Health check passes after deploy
4. GCS backup configured and working

### Repository Hygiene
- `.gitignore` covers: `.env`, `*.db`, `node_modules/`, `dist/`, deployment configs
- No large binary files in git (images go to CDN or separate branch)
- Commit history: clean, meaningful messages, no merge commits on main
- Remote: `https://github.com/KoNananachan/Neuberg.git`

---

## Production Environment

### Cloud Run Config
- Region: us-central1
- CPU: 1, Memory: 1Gi
- Min instances: 1, Max instances: 3
- Port: 8080

### Required Environment Variables
| Variable | Purpose |
|----------|---------|
| DATABASE_URL | SQLite path |
| AI_API_KEY | LLM provider key |
| AI_BASE_URL | LLM endpoint |
| AI_MODEL | Model name |
| NEWS_API_URL | News data source |
| ALLOWED_ORIGINS | CORS whitelist (comma-separated) |
| ENCRYPTION_KEY | AES-256 key for credential encryption |
| GCS_BUCKET | Database backup bucket |
| GOOGLE_CLIENT_ID | OAuth |
| STRIPE_SECRET_KEY | Billing (optional, currently disabled) |
| STRIPE_WEBHOOK_SECRET | Webhook verification (optional) |
| STRIPE_PRICE_ID | Pro subscription price (optional) |
| RESEND_API_KEY | Email sending (optional) |

---

*Last updated: 2026-03-09*
*Maintainer: KoNananachan*
