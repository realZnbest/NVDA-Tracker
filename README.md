# NVDA Instrument Wall

A personal NVIDIA (NVDA) analysis dashboard: candlestick price chart with RSI/MACD/MA/Bollinger, a curated news feed, financial statement trends, rule-based technical + fundamental analysis, and threshold alerts. Thai-language UI throughout.

## Setup

1. Get a free API key at [finnhub.io/register](https://finnhub.io/register) (no card required).
2. Copy `.env.local.example` to `.env.local` and paste your key:
   ```bash
   cp .env.local.example .env.local
   ```
3. Install dependencies and run:
   ```bash
   npm install
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000).

## Notes

- Data provider is Finnhub's free tier (60 requests/min). Responses are cached briefly server-side to stay under that limit.
- Alerts are stored locally in `data/alerts.db` (SQLite) and evaluated while the app is open, on a ~90s interval.
- Deploying later (e.g. to Render.com): set `FINNHUB_API_KEY` as an environment variable there; nothing in the code assumes localhost. If the host's disk is ephemeral, `data/alerts.db` will reset on redeploy.
- See `DESIGN.md` for the visual system and `PRODUCT.md` for product scope.
