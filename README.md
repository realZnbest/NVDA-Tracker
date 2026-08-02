# NVDA Instrument Wall

A personal NVIDIA (NVDA) analysis dashboard: candlestick price chart with RSI/MACD/MA/Bollinger, support/resistance and BOS/CHoCH structure detection, a curated news feed, financial statement trends, rule-based technical + fundamental analysis, AI-generated summaries and an AI chat widget, Wall Street analyst consensus, threshold alerts, and private portfolio tracking (purchase lots, break-even line, position-aware analysis). Thai-language UI throughout.

## Setup

1. Get a free API key at [finnhub.io/register](https://finnhub.io/register) (no card required).
2. (Optional, for the "สรุปโดย AI" summary cards) Get a free Gemini API key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
3. (Required for alerts to survive a Render redeploy) Set up Turso — see below.
4. (Required to view/manage alerts) Set `ALERTS_PASSWORD` to any password of your choosing — the site is public, so alerts/notifications are locked behind this.
5. Copy `.env.local.example` to `.env.local` and paste your key(s):
   ```bash
   cp .env.local.example .env.local
   ```
5. Install dependencies and run:
   ```bash
   npm install
   npm run dev
   ```
6. Open [http://localhost:3000](http://localhost:3000).

### Setting up Turso (alert storage)

Render's filesystem is ephemeral — a local SQLite file resets on every deploy, which means any alerts you'd created disappear. Turso is a hosted, SQLite-compatible database with a generous free tier and no project-count cap, so alerts persist independently of the app's own filesystem.

1. Sign up free at [turso.tech](https://turso.tech).
2. **Create Database** (any name, any region).
3. On the database page, copy the **Database URL** (`libsql://...`) and click **Create Token** to get an auth token.
4. Set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.

Tables are created automatically on first connect — no manual SQL step. Without these two set, the site still works fully as a read-only dashboard; only creating/editing/deleting alerts needs them.

### Alerts password

The dashboard itself (price, chart, news, financials) is meant to be publicly viewable if you share the link. Alerts, notifications, and your portfolio are not — they're your own trading rules, trigger history, and holdings — so `/alerts`, `/portfolio`, the notification bell, and all their API routes require `ALERTS_PASSWORD` to view or manage. Entering the password once sets a signed, httpOnly cookie in your browser (30-day expiry); nothing is exposed to visitors who don't have it, including alert evaluation itself (it only runs for an authenticated session, so a stranger can't even trigger it to see what fires). Without `ALERTS_PASSWORD` set, those sections just show a "not configured" message.

The break-even line on the price chart and the "ด้านพอร์ต" line in the analysis panel both live on the public `/dashboard` page but only render for a logged-in owner session — a visitor without the password sees the exact same chart/analysis as always, no portfolio data included.

### Portfolio tracking

`/portfolio` lets you log individual purchases (date, shares, price per share) rather than a single editable position — average cost and total shares are always derived from the full purchase history, so the numbers stay correct as you add more lots over time. Two alert types (`พอร์ตกำไรถึง (%)` / `พอร์ตขาดทุนถึง (%)`) let you set unrealized P&L thresholds alongside the existing price/RSI/MACD/MA alert types.

## Notes

- Data provider is Finnhub's free tier (quote, news, financials, analyst recommendation trends — 60 requests/min, cached server-side) plus Yahoo Finance's free chart endpoint (historical candles and pre/post-market prices; Finnhub's own candle and price-target endpoints are paid-only, and an earlier attempt to get price targets from an unofficial Yahoo endpoint was abandoned after it proved permanently rate-limited from Render's IP — see `PRODUCT.md`).
- The AI summary cards try a chain of providers in order — Gemini keys, then Groq keys, then OpenRouter keys, whichever are configured — falling through to the next one if a key hits its free-tier rate limit. Responses are cached server-side for 1 hour per page. Without any key set, those cards just show a "not configured" message — everything else in the app works fine without it.
- The AI chat widget (bottom-right on `/dashboard`, public, no auth) shares the exact same provider chain and keys — no separate setup needed. Each reply is grounded with live quote/news/financials context pulled from the same cached Finnhub calls the rest of the dashboard uses. Rate-limited per IP (20 messages/10 min, in-memory — resets on redeploy) and capped at 500 characters per message to keep costs bounded on a public, unauthenticated endpoint. Shows a persistent "not investment advice" disclaimer and fails gracefully with a Thai message if every provider is unavailable.
- Alerts are stored in Turso and evaluated on a ~90s interval, but only while you're logged in with `ALERTS_PASSWORD` in an open tab (there's no separate scheduled job).
- (Optional) Set `RESEND_API_KEY` and `ALERT_EMAIL_TO` to also get an email the moment an alert fires, on top of the in-app notification — see `.env.local.example`. Free tier, no card required.
- See `DESIGN.md` for the visual system and `PRODUCT.md` for product scope.

## Deploying to Render.com

1. **Push this repo to GitHub** (Render deploys from a git repo):
   ```bash
   git remote add origin <your-empty-github-repo-url>
   git push -u origin main
   ```
2. On [render.com](https://render.com), **New → Web Service**, connect the GitHub repo.
3. Settings:
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
4. **Environment variables:** add `FINNHUB_API_KEY`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and `ALERTS_PASSWORD` (Environment tab); optionally add any of the AI provider keys from `.env.local.example` for the AI summary cards (`GEMINI_API_KEY` alone is enough, the rest are just extra fallback quota) and/or `RESEND_API_KEY`/`ALERT_EMAIL_TO` for email alerts.
5. Deploy. First build takes a few minutes.

That's it — no persistent disk needed anymore (Turso lives outside Render entirely), and no code changes needed for any of this; the app reads everything from the environment rather than assuming localhost.
