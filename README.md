# NVDA Instrument Wall

A personal NVIDIA (NVDA) analysis dashboard: candlestick price chart with RSI/MACD/MA/Bollinger, support/resistance and BOS/CHoCH structure detection, a curated news feed, financial statement trends, rule-based technical + fundamental analysis, AI-generated casual-Thai summaries, Wall Street analyst consensus, threshold alerts (price, RSI, MACD, MA cross, and portfolio P&L), and a personal position tracker with a break-even overlay on the chart. Thai-language UI throughout.

The site is public and read-only for anyone — no login needed to view price, financials, news, your position, or your alerts. Editing your position or your alerts requires a one-time magic-link login sent to a single owner email (see below); there's no password or user system, just a lock on write actions.

## Setup

1. Get a free API key at [finnhub.io/register](https://finnhub.io/register) (no card required).
2. (Optional, for the "สรุปโดย AI" summary cards) Get a free Gemini API key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
3. (Required to edit your position/alerts, and for alert emails) Set up Resend — see below.
4. Copy `.env.local.example` to `.env.local` and fill in your key(s):
   ```bash
   cp .env.local.example .env.local
   ```
5. Install dependencies and run:
   ```bash
   npm install
   npm run dev
   ```
6. Open [http://localhost:3000](http://localhost:3000).

### Setting up Resend (email)

Resend's free tier is enough for this — every email this app sends goes to one address (`OWNER_EMAIL`), and Resend's sandbox sender can email an account's *own* verified address without any domain/DNS setup.

1. Sign up free at [resend.com](https://resend.com).
2. Verify your own email during onboarding — this becomes both `OWNER_EMAIL` and the only address Resend's sandbox sender (`onboarding@resend.dev`) is allowed to send to without a verified domain.
3. Create an API key (Dashboard → API Keys) and set `RESEND_API_KEY`.
4. Set `OWNER_EMAIL` to that same verified address.

Without these two set, the site still works fully as a read-only dashboard — you just can't request edit access, and alerts stay in-app-only (no email).

## Notes

- Data provider is Finnhub's free tier (quote, news, financials — 60 requests/min, cached server-side) plus Yahoo Finance's free chart endpoint (historical candles, pre/post-market prices, and analyst price targets; Finnhub's own candle endpoint is paid-only).
- The AI summary cards try a chain of providers in order — Gemini keys, then Groq keys, then OpenRouter keys, whichever are configured — falling through to the next one if a key hits its free-tier rate limit. Responses are cached server-side for 1 hour per page.
- Alerts (price, RSI, MACD, MA cross, and portfolio P&L) are evaluated server-side and stored in `data/alerts.db` (SQLite). Evaluation is triggered by a scheduled job hitting `/api/alerts/check`, **not** by visitors having a tab open — see the Render Cron Job section below, which is what makes email delivery actually reliable.
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
4. **Environment variables** (Environment tab): add everything from `.env.local.example` that you're using — at minimum `FINNHUB_API_KEY`. For edit access + email, add `OWNER_EMAIL` and `RESEND_API_KEY`. Generate a random string for `CRON_SECRET` (e.g. `openssl rand -hex 32`) — you'll reuse it in step 6.
5. **Persistent disk** (so your position/alerts survive a redeploy): Render's free tier has an ephemeral filesystem — without a disk, `data/alerts.db` resets every time you deploy. Add one under **Disks**: mount path `/var/data`, then add an environment variable `DATA_DIR=/var/data`. (A disk requires a paid instance type; on the free tier, your data will just reset on each deploy — everything else works fine.)
6. **Render Cron Job** (makes alert emails actually fire while you're not looking — this is the whole point of email delivery):
   - **New → Cron Job** in the same Render project.
   - **Command:**
     ```bash
     curl -fsS -X POST https://<your-app>.onrender.com/api/alerts/check -H "X-Cron-Secret: <same value as CRON_SECRET>"
     ```
   - **Schedule:** `*/5 * * * *` (every 5 minutes) or `*/10 * * * *` (every 10) — either is fine for a stock that doesn't move minute-to-minute in a way that needs faster checking.
   - Cron Jobs can't mount a persistent disk, which is exactly why this hits the web service over HTTP instead of touching the database directly — all the actual logic and DB access stays inside the one web service process.
   - Cost: Render Cron Jobs have a $1/month minimum charge (no free tier for the cron resource itself, separate from the web service's own free tier).
7. Deploy. First build takes a few minutes (it compiles the SQLite native module).

That's it — no code changes needed for any of this; the app reads all of `FINNHUB_API_KEY`, `DATA_DIR`, `OWNER_EMAIL`, `RESEND_API_KEY`, and `CRON_SECRET` from the environment rather than assuming localhost.
