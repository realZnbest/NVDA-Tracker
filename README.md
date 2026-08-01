# NVDA Instrument Wall

A personal NVIDIA (NVDA) analysis dashboard: candlestick price chart with RSI/MACD/MA/Bollinger, support/resistance and BOS/CHoCH structure detection, a curated news feed, financial statement trends, rule-based technical + fundamental analysis, AI-generated casual-Thai summaries, and threshold alerts. Thai-language UI throughout.

## Setup

1. Get a free API key at [finnhub.io/register](https://finnhub.io/register) (no card required).
2. (Optional, for the "สรุปโดย AI" summary cards) Get a free Gemini API key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
3. Copy `.env.local.example` to `.env.local` and paste your key(s):
   ```bash
   cp .env.local.example .env.local
   ```
4. Install dependencies and run:
   ```bash
   npm install
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000).

## Notes

- Data provider is Finnhub's free tier (quote, news, financials — 60 requests/min, cached server-side) plus Yahoo Finance's free chart endpoint (historical candles and pre/post-market prices; Finnhub's own candle endpoint is paid-only).
- The AI summary cards call Google's Gemini API (`gemini-3.5-flash` by default, thinking disabled for speed) and are cached server-side for 1 hour per page. Without `GEMINI_API_KEY` set, those cards just show a "not configured" message — everything else in the app works fine without it.
- Alerts are stored locally in `data/alerts.db` (SQLite) and evaluated while the app is open, on a ~90s interval.
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
4. **Environment variables:** add `FINNHUB_API_KEY` with your key (Environment tab); optionally add `GEMINI_API_KEY` (and `GEMINI_MODEL` if you want a different model) for the AI summary cards.
5. **Persistent disk** (so your alerts survive a redeploy): Render's free tier has an ephemeral filesystem — without a disk, `data/alerts.db` resets every time you deploy. Add one under **Disks**: mount path `/var/data`, then add an environment variable `DATA_DIR=/var/data`. (A disk requires a paid instance type; on the free tier, alerts will just reset on each deploy — everything else works fine.)
6. Deploy. First build takes a few minutes (it compiles the SQLite native module).

That's it — no code changes needed for any of this; the app already reads `FINNHUB_API_KEY` and `DATA_DIR` from the environment rather than assuming localhost.
