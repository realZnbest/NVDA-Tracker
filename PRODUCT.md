# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegated: Next.js (App Router, TypeScript) + `lightweight-charts` (TradingView's open-source charting library) for the candlestick/volume/indicator panels, a small SQLite store (via `better-sqlite3`) for user-created alerts and watchlist state, and Next.js API routes as the Finnhub proxy/backend. Chosen because:
- **Next.js**: single codebase serves both the UI and the backend API routes needed to keep the Finnhub key server-side and to run alert-evaluation logic — and it deploys cleanly to Render.com later with no rewrite.
- **lightweight-charts**: purpose-built for financial candlestick/volume data with native pan/zoom, crosshair, and multi-pane (price + RSI + MACD) support out of the box — this is what gives the "real trading terminal" feel the design bar requires, versus a generic charting library retrofitted with candlestick support.
- **SQLite**: zero-ops persistence appropriate for a single-user tool; file-based, no separate DB service to run locally or on Render.

## Users

Single user (the product owner): holds one equity position, NVDA, and wants a dedicated, deep analysis tool for that one ticker — not a general multi-stock tracker. Reads Thai as primary language; all on-screen UI text must be natural Thai financial terminology, not machine-translated.

## Product Purpose

A personal NVDA-only dashboard that combines live/historical price action, technical indicators, curated news, financial statements, and a rule-based technical+fundamental "read" into one focused tool, so the owner can evaluate their position without stitching together multiple generic stock sites. Success = the owner can, in one sitting, see price/trend, check indicator state, skim relevant news, review financial trend, get a synthesized technical/fundamental read, and manage threshold alerts for that position.

## Positioning

Not a multi-ticker screener or general portfolio tracker — a single-ticker deep tool, in Thai, purpose-built around one person's actual holding, including that holding's real cost basis and P&L. The synthesized rule-based analysis (plain-language technical + fundamental read, not just raw numbers, and now aware of the owner's own position) is the differentiating mechanism versus a generic charting site.

## Operating Context

- Deployed to Render.com (Web Service). Architecture never assumes localhost (no hardcoded URLs, everything via env vars), so local dev and the deployed instance run identical code paths.
- Alert evaluation is server-driven, not visitor-driven: a Render Cron Job hits `/api/alerts/check` on a schedule (every 5–10 min) independent of whether anyone has a tab open, protected by a shared `CRON_SECRET` header. Fired alerts are written to the in-app notification store and (when `OWNER_EMAIL`/`RESEND_API_KEY` are set) emailed via Resend — email is the primary reliable channel since the in-app badge only helps while a tab happens to be open.
- The site is public and read-only for anyone by default. Editing the owner's position or alerts requires an active edit session, obtained via a single-use magic link emailed to the one configured `OWNER_EMAIL` (15-minute link, ~24h session cookie). This is deliberately not a real auth system — no password, no user table, no multi-account signup — just a lock on write actions for a publicly-reachable personal tool.
- Data provider: Finnhub (free tier) for quote/news/financials, Yahoo Finance's free chart endpoint for historical candles, pre/post-market prices, and analyst price targets (Finnhub's own candle endpoint is paid-only). Constraints to design around: ~60 API calls/minute Finnhub rate limit, slightly delayed (not tick-level real-time) US equity quotes — requests are cached/throttled server-side rather than re-fetched on every interaction.
- AI summaries (News and Financials pages) call a chain of LLM providers in order — Gemini keys, then Groq keys, then OpenRouter keys, whichever are configured (`GEMINI_API_KEY`(+`_BACKUP`/`_SECONDARY`), `GROQ_API_KEY`(+`_BACKUP`), `OPENROUTER_API_KEY`(+`_BACKUP`); each provider's model configurable via its `*_MODEL` var) — falling through to the next if one hits its free-tier rate limit. Optional: the app works fully with none of these set, those two cards just show a "not configured" message. Server-cached 1 hour per page to limit calls; prompts instruct the model to use only the supplied figures/headlines, no investment advice, casual conversational Thai tone.

## Capabilities and Constraints

- Candlestick price chart for NVDA with adjustable timeframes (1H/1D/5D/1W/1M/3M/6M/YTD/1Y/5Y), volume bars, smooth zoom/pan. Each tab fetches the maximum history available at that granularity so zooming out reveals real data rather than a dead edge; the tab only sets the default scoped view.
- Indicators: RSI (mandatory, own panel) plus an RSI-based moving average, MACD (own panel), SMA/EMA with configurable periods (default 20/50/200), Bollinger Bands, support/resistance levels (clustered swing pivots), and BOS/CHoCH market-structure markers. Overlays (MA, Bollinger, S/R) render on the price pane; oscillators (RSI, MACD) render in separate panes below. All indicators toggleable with adjustable parameters.
- Dedicated news page: NVDA-specific headlines from Finnhub's company-news endpoint, each with headline, source, timestamp, short summary, presented as a curated feed (not a raw list dump), plus an AI-generated casual-Thai digest at the top.
- Financial statements page: income statement, balance sheet, cash flow — at minimum revenue, net income, EPS, margins, debt, free cash flow — with trend visualization across recent quarters/years, not tables alone, plus an AI-generated casual-Thai digest at the top.
- Analyst consensus panel: Finnhub recommendation trends (Buy/Hold/Sell breakdown) plus Yahoo analyst price-target range (via an unofficial crumb-authenticated endpoint — more fragile than the rest of the app's Yahoo usage; degrades gracefully to "unavailable" with the real error shown rather than fabricated data).
- Analysis tool: rule-based synthesis (no LLM call) that interprets current indicator readings (RSI overbought/oversold, MACD crossover, trend direction) and contextualizes fundamentals (growth trends, P/E, P/S vs historical average) into a plain-language read; when a position is set, adds a position-aware section (gain/loss, proximity to break-even, how the read relates to the owner's situation) — purely observational, never an explicit buy/sell instruction, with the "not investment advice" disclaimer made visually prominent. Separate from the AI summary cards above, which do call an LLM (Gemini/Groq/OpenRouter) specifically to digest financials/news into a short casual read.
- Position tracker: owner's avg cost/share, share count, and start date (one position, edit-gated). Dashboard shows live unrealized P&L ($ and %), position value, cost basis, and days held, computed from the same live quote used elsewhere. A dashed break-even reference line overlays the price chart (toggleable, neutral color distinct from indicator channels).
- Alerts: user-creatable threshold rules (price cross, RSI overbought/oversold, MACD crossover, MA golden/death cross, and portfolio gain/loss % vs the owner's position), viewable by anyone, create/edit/delete gated behind an edit session, surfaced via in-app notification panel + badge and (when configured) email.
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
