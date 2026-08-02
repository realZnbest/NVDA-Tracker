# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegated: Next.js (App Router, TypeScript) + `lightweight-charts` (TradingView's open-source charting library) for the candlestick/volume/indicator panels, Turso (hosted SQLite-compatible, via `@libsql/client`) for user-created alerts, and Next.js API routes as the Finnhub proxy/backend. Chosen because:
- **Next.js**: single codebase serves both the UI and the backend API routes needed to keep the Finnhub key server-side and to run alert-evaluation logic — and it deploys cleanly to Render.com later with no rewrite.
- **lightweight-charts**: purpose-built for financial candlestick/volume data with native pan/zoom, crosshair, and multi-pane (price + RSI + MACD) support out of the box — this is what gives the "real trading terminal" feel the design bar requires, versus a generic charting library retrofitted with candlestick support.
- **Turso, not local SQLite**: Render's own filesystem is ephemeral (resets on every redeploy), so a local `better-sqlite3` file — the original choice — silently lost all alerts on each deploy. Supabase (Postgres) was tried first but the owner had already hit its free-tier project cap from prior unrelated projects; Turso has no such cap and, being SQLite-compatible, needed the smallest possible rewrite of the existing query logic.

## Users

Single user (the product owner): holds one equity position, NVDA, and wants a dedicated, deep analysis tool for that one ticker — not a general multi-stock tracker. Reads Thai as primary language; all on-screen UI text must be natural Thai financial terminology, not machine-translated.

## Product Purpose

A personal NVDA-only dashboard that combines live/historical price action, technical indicators, curated news, financial statements, and a rule-based technical+fundamental "read" into one focused tool, so the owner can evaluate their position without stitching together multiple generic stock sites. Success = the owner can, in one sitting, see price/trend, check indicator state, skim relevant news, review financial trend, get a synthesized technical/fundamental read, and manage threshold alerts for that position.

## Positioning

Not a multi-ticker screener or portfolio tracker — a single-ticker deep tool, in Thai, purpose-built around one person's actual holding. The synthesized rule-based analysis (plain-language technical + fundamental read, not just raw numbers) is the differentiating mechanism versus a generic charting site.

## Operating Context

- Runs locally first via `npm run dev` (localhost) for personal use; if it proves useful, the owner intends to deploy it to Render.com later. Architecture must not assume localhost-only (no hardcoded localhost URLs, config via env vars) so that move is a deploy, not a rewrite.
- Alerts are evaluated while the app is open/running (in-app notification panel + badge is the priority delivery method). Background/out-of-tab delivery (push, email) is out of scope for the local-dev phase; revisit once hosted on Render.com where a scheduled job could run alert checks continuously.
- Data provider: Finnhub (free tier) for quote/news/financials, Yahoo Finance's free chart endpoint for historical candles and pre/post-market prices (Finnhub's own candle endpoint is paid-only). Constraints to design around: ~60 API calls/minute Finnhub rate limit, slightly delayed (not tick-level real-time) US equity quotes — requests are cached/throttled server-side rather than re-fetched on every interaction.
- AI summaries (News and Financials pages) call a chain of LLM providers in order — Gemini keys, then Groq keys, then OpenRouter keys, whichever are configured (`GEMINI_API_KEY`(+`_BACKUP`/`_SECONDARY`), `GROQ_API_KEY`(+`_BACKUP`), `OPENROUTER_API_KEY`(+`_BACKUP`); each provider's model configurable via its `*_MODEL` var) — falling through to the next if one hits its free-tier rate limit. Optional: the app works fully with none of these set, those two cards just show a "not configured" message. Server-cached 1 hour per page to limit calls; prompts instruct the model to use only the supplied figures/headlines, no investment advice, casual conversational Thai tone.

## Capabilities and Constraints

- Candlestick price chart for NVDA with adjustable timeframes (1H/1D/5D/1W/1M/3M/6M/YTD/1Y/5Y), volume bars, smooth zoom/pan. Each tab fetches the maximum history available at that granularity so zooming out reveals real data rather than a dead edge; the tab only sets the default scoped view.
- Indicators: RSI (mandatory, own panel) plus an RSI-based moving average, MACD (own panel), SMA/EMA with configurable periods (default 20/50/200), Bollinger Bands, support/resistance levels (clustered swing pivots), and BOS/CHoCH market-structure markers. Overlays (MA, Bollinger, S/R) render on the price pane; oscillators (RSI, MACD) render in separate panes below. All indicators toggleable with adjustable parameters.
- Dedicated news page: NVDA-specific headlines from Finnhub's company-news endpoint, each with headline, source, timestamp, short summary, presented as a curated feed (not a raw list dump), plus an AI-generated casual-Thai digest at the top.
- Financial statements page: income statement, balance sheet, cash flow — at minimum revenue, net income, EPS, margins, debt, free cash flow — with trend visualization across recent quarters/years, not tables alone, plus an AI-generated casual-Thai digest at the top.
- Analyst consensus panel: Buy/Hold/Sell breakdown and a computed consensus badge from Finnhub's free recommendation-trends endpoint. A Yahoo price-target version was tried and removed — Yahoo's crumb-authenticated endpoint kept returning 429 from Render's IP regardless of headers/backoff/redirect fixes, so it was a dead end rather than a bug to keep patching; Finnhub-only is what's reliable in production.
- Analysis tool: rule-based synthesis (no LLM call) that interprets current indicator readings (RSI overbought/oversold, MACD crossover, trend direction) and contextualizes fundamentals (growth trends, P/E, P/S vs historical average) into a plain-language read. Separate from the AI summary cards above, which do call an LLM (Gemini) specifically to digest financials/news into a short casual read.
- Alerts: user-creatable threshold rules (price cross, RSI overbought/oversold, MACD crossover, MA golden/death cross, portfolio P&L above/below), manageable (create/edit/delete) from one Alerts panel/page, surfaced via in-app notification panel + badge and (optionally) email via Resend, persisted in Turso so they survive a Render redeploy. The rest of the dashboard is public by design (shareable link), but alerts/notifications/portfolio are the owner's private data, so `/alerts`, `/portfolio`, the notification bell, and their API routes require a single shared `ALERTS_PASSWORD` (signed cookie session) — visitors without it can't view alert rules, notification history, portfolio holdings, or even trigger evaluation.
- Portfolio: `/portfolio` page for logging individual NVDA purchase lots (date, shares, price per share); average cost and total shares are always derived from the full lot history rather than stored directly, so editing/deleting a lot recalculates everything downstream. The derived cost basis surfaces in three private, auth-gated places on the otherwise-public dashboard: a break-even price line on the chart, a "ด้านพอร์ต" line in the rule-based analysis panel, and the two portfolio alert types above — all computed client-side or behind `requireAlertsAuth()`, never baked into the public `/api/analysis`/chart data itself.
- All user-facing copy (labels, nav, headings, tooltips, alerts, analysis text) must be natural Thai financial terminology. Code, comments, and identifiers stay in English.
- Undecided: exact retained history window for cached candle data.

## Evidence on Hand

None yet — no existing financial data, news content, or brand assets on hand. All price, indicator, news, and financial-statement data comes live from the Finnhub API at runtime; nothing should be fabricated as placeholder "real" data in the shipped product (loading/empty states instead).

## Product Principles

1. One ticker, full depth — every feature exists to deepen understanding of this single NVDA position, not to generalize to other tickers.
2. Terminal-grade price chart is the centerpiece — indicators, news, and financials support it, not compete with it.
3. Synthesis over data dumping — the analysis tool must produce a genuinely useful plain-language read, not restate numbers the owner can already see on the chart/table.
4. Thai-first UI — every user-facing string is natural Thai financial terminology; this is a hard constraint, not a translation pass at the end.
5. Respect the data provider's limits — cache/throttle Finnhub calls rather than hitting rate limits during normal chart interaction.
