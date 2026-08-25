# NVDA Instrument Wall

A personal NVIDIA (NVDA) analysis dashboard: candlestick price chart with RSI/MACD/MA/Bollinger, support/resistance and BOS/CHoCH structure detection, a curated news feed, financial statement trends, rule-based technical + fundamental analysis, AI-generated summaries and an AI chat widget, Wall Street analyst consensus, threshold alerts, and private portfolio tracking (purchase lots, break-even line, position-aware analysis). Thai-language UI throughout.

## Setup

1. Get a free API key at [finnhub.io/register](https://finnhub.io/register) (no card required).
2. (Optional, for the "สรุปโดย AI" summary cards) Get a free Gemini API key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
3. (Required for alerts to survive a redeploy) Set up Turso — see below.
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

Serverless hosts have an ephemeral filesystem — a local SQLite file resets on every deploy (and often between invocations), which means any alerts you'd created disappear. Turso is a hosted, SQLite-compatible database with a generous free tier and no project-count cap, so alerts persist independently of the app's own filesystem.

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

- The chart remembers your workspace: timeframe, which indicators are on, and their periods are stored in your browser and restored on the next visit (reset them from the "ตัวชี้วัด" popover). Hovering the chart drives a readout strip showing that bar's O/H/L/C, change, volume, RSI and MACD; move the pointer away and it falls back to the latest bar.
- Price, comparison chart and quote refresh themselves on a timer while the tab is open — silently, so a zoom or pan is never reset — and pause entirely while the tab is in the background, refreshing the moment you come back.
- Data provider is Finnhub's free tier (quote, news, financials, analyst recommendation trends — 60 requests/min, cached server-side) plus Yahoo Finance's free chart endpoint (historical candles and pre/post-market prices; Finnhub's own candle and price-target endpoints are paid-only, and an earlier attempt to get price targets from an unofficial Yahoo endpoint was abandoned after it proved permanently rate-limited from shared datacenter IPs — see `PRODUCT.md`). Finnhub calls fall back across up to 3 keys (`FINNHUB_API_KEY` + optional `_BACKUP`/`_SECONDARY`) on rate-limit or auth failure, same chain pattern as the AI providers below — only `FINNHUB_API_KEY` is required.
- The AI summary cards try a chain of providers in order — Gemini keys, then Groq keys, then OpenRouter keys, whichever are configured — falling through to the next one if a key hits its free-tier rate limit. Responses are cached server-side for 1 hour per page. Without any key set, those cards just show a "not configured" message — everything else in the app works fine without it.
- The AI chat widget (bottom-right on `/dashboard`, public, no auth) shares the exact same provider chain and keys — no separate setup needed. Each reply is grounded with live quote/news/financials context pulled from the same cached Finnhub calls the rest of the dashboard uses. Rate-limited per IP (20 messages/10 min, in-memory — resets on redeploy) and capped at 500 characters per message to keep costs bounded on a public, unauthenticated endpoint. Shows a persistent "not investment advice" disclaimer and fails gracefully with a Thai message if every provider is unavailable.
- Alerts are stored in Turso and evaluated on a ~90s interval, but only while you're logged in with `ALERTS_PASSWORD` in an open tab (there's no scheduled job for *alerts* — the only scheduled job is the daily summary below, which doesn't evaluate alerts).
- (Optional) A daily after-market summary email — see "Daily summary email" below.
- (Optional) Set `RESEND_API_KEY` and `ALERT_EMAIL_TO` to also get an email the moment an alert fires, on top of the in-app notification — see `.env.local.example`. Free tier, no card required.
- See `DESIGN.md` for the visual system and `PRODUCT.md` for product scope.

### Daily summary email

Every weekday morning at ~06:00 Thailand time, `.github/workflows/daily-summary.yml` POSTs to `/api/daily-summary`, which emails you a single after-market digest covering NVDA plus every symbol you hold: full OHLC and volume vs its 20-day average, RSI/MACD/MA20-50-200/Bollinger, support-resistance levels and BOS/CHoCH structure, P/E, P/S, margins, revenue growth, FCF, analyst consensus, an earnings countdown, the top 5 news headlines, and your position (average cost, shares, unrealized P&L in $ and %, distance to break-even, projected P&L at target prices). Those raw numbers are then fed into the same AI provider chain the summary cards use, which writes one Thai narrative tying them together — printed alongside the numbers, under a "ไม่ใช่คำแนะนำการลงทุน" disclaimer. If every AI provider is unavailable, the narrative falls back to the app's own rule-based analysis, so the email always sends.

To enable it:

1. Set `CRON_SECRET` (any long random string, e.g. `openssl rand -hex 32`) in your hosting provider's environment (on Vercel: Project → Settings → Environment Variables), alongside the `RESEND_API_KEY`/`ALERT_EMAIL_TO` the email itself needs.
2. In the GitHub repo, **Settings → Secrets and variables → Actions**, add two repository secrets:
   - `APP_BASE_URL` — your deployed URL, e.g. `https://nvda-tracker.vercel.app`
   - `CRON_SECRET` — the exact same value as step 1
3. Test it without waiting for the cron: the workflow has a **Run workflow** button (Actions tab), or `GET /api/daily-summary` from a logged-in browser session returns the composed email as plain text without sending it.

The schedule is `0 23 * * 1-5` — 23:00 UTC is 06:00 the next day in Thailand (UTC+7, no DST) and is after the US close in both US DST states, so the one expression is correct year-round. Note that GitHub's scheduled runs are best-effort and can drift several minutes late under load.

Without `CRON_SECRET` set, `/api/daily-summary` behaves exactly like every other private route — owner session only — and the workflow just fails with a 401, sending nothing.

## Deploying to Vercel (free)

[Vercel](https://vercel.com)'s Hobby plan is free, requires no card, and is made by the Next.js team — the repo deploys with zero configuration.

1. **Push this repo to GitHub** (Vercel deploys from a git repo):
   ```bash
   git remote add origin <your-empty-github-repo-url>
   git push -u origin main
   ```
2. On [vercel.com](https://vercel.com), sign up and **Add New → Project**, then import the GitHub repo. Leave all build settings at their defaults (`npm run build` / Next.js is auto-detected) and deploy.
3. **Environment variables:** in Project → Settings → Environment Variables, add `FINNHUB_API_KEY`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and `ALERTS_PASSWORD`; optionally add `FINNHUB_API_KEY_BACKUP`/`FINNHUB_API_KEY_SECONDARY` for extra fallback quota, any of the AI provider keys from `.env.local.example` for the AI summary cards (`GEMINI_API_KEY` alone is enough, the rest are just extra fallback quota), and/or `RESEND_API_KEY`/`ALERT_EMAIL_TO` for email alerts (plus `CRON_SECRET` if you want the daily summary email). Redeploy after adding them so they take effect.
4. If you use the daily summary email, update the `APP_BASE_URL` GitHub secret to your Vercel URL (e.g. `https://nvda-tracker.vercel.app`) — see "Daily summary email" above.

That's it — no persistent disk needed (Turso lives outside the app entirely), and no code changes were needed for any of this; the app reads everything from the environment rather than assuming localhost.

### Vercel-specific notes

- The Hobby plan is for personal, non-commercial use — exactly what this dashboard is.
- Instances are short-lived serverless functions: in-memory caches (Finnhub responses, AI summaries, chat rate limits) reset more often than on a traditional host, which just means an occasional extra upstream call — behavior is otherwise identical.
- The Finnhub trade websocket (`src/lib/finnhub-ws.ts`) keeps a persistent connection per process to shave 20-30s of lag off quotes; on serverless those processes come and go, so most requests fall back to the REST snapshot quote (the code already handles this gracefully — it's a freshness regression during market hours, not a breakage).
- Long-running routes export `maxDuration = 60` (`/api/daily-summary`, `/api/chat`, `/api/ai-summary`), which fits comfortably inside the Hobby limit.
