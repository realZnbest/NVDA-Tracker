# NVDA Instrument Wall

A personal NVIDIA (NVDA) analysis dashboard: candlestick price chart with RSI/MACD/MA/Bollinger, support/resistance and BOS/CHoCH structure detection, a curated news feed, financial statement trends, rule-based technical + fundamental analysis, AI-generated casual-Thai summaries, Wall Street analyst consensus, and threshold alerts. Thai-language UI throughout.

## Setup

1. Get a free API key at [finnhub.io/register](https://finnhub.io/register) (no card required).
2. (Optional, for the "สรุปโดย AI" summary cards) Get a free Gemini API key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
3. (Required for alerts to survive a Render redeploy) Set up Turso — see below.
4. Copy `.env.local.example` to `.env.local` and paste your key(s):
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

## Notes

- Data provider is Finnhub's free tier (quote, news, financials, analyst recommendation trends — 60 requests/min, cached server-side) plus Yahoo Finance's free chart endpoint (historical candles and pre/post-market prices; Finnhub's own candle and price-target endpoints are paid-only, and an earlier attempt to get price targets from an unofficial Yahoo endpoint was abandoned after it proved permanently rate-limited from Render's IP — see `PRODUCT.md`).
- The AI summary cards try a chain of providers in order — Gemini keys, then Groq keys, then OpenRouter keys, whichever are configured — falling through to the next one if a key hits its free-tier rate limit. Responses are cached server-side for 1 hour per page. Without any key set, those cards just show a "not configured" message — everything else in the app works fine without it.
- Alerts are stored in Turso and evaluated while the app is open, on a ~90s interval (triggered by any visitor's browser polling — there's no separate scheduled job).
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
4. **Environment variables:** add `FINNHUB_API_KEY`, `TURSO_DATABASE_URL`, and `TURSO_AUTH_TOKEN` (Environment tab); optionally add any of the AI provider keys from `.env.local.example` for the AI summary cards — `GEMINI_API_KEY` alone is enough, the rest are just extra fallback quota.
5. Deploy. First build takes a few minutes.

That's it — no persistent disk needed anymore (Turso lives outside Render entirely), and no code changes needed for any of this; the app reads everything from the environment rather than assuming localhost.
