---
name: NVDA Instrument Wall
description: A personal NVIDIA analysis dashboard styled as a data-center NOC instrument wall — because NVDA's own business is the chips that run data centers.
colors:
  bg: "#0a0c0f"
  bg-raised: "#0f1216"
  panel: "#12151b"
  panel-2: "#161a21"
  seam: "#262c35"
  seam-bright: "#3a4250"
  rivet: "#2c333d"
  text-primary: "#e8ecf1"
  text-secondary: "#9aa4b2"
  text-muted: "#5f6875"
  ch-price: "#79b900"
  ch-price-dim: "#34430c"
  ch-volume: "#3fc4d8"
  ch-volume-dim: "#23525a"
  ch-rsi: "#b28cf2"
  ch-rsi-dim: "#4a3d66"
  ch-macd: "#2fd6a6"
  ch-macd-dim: "#1f5a49"
  ch-alert: "#ef4a4a"
  ch-alert-dim: "#5c2222"
  up: "#34d17c"
  down: "#ef5b5b"
  session-extended: "#e3a94b"
typography:
  display:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "2rem"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "0.01em"
  body:
    fontFamily: "IBM Plex Sans Thai, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "0.625rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.14em"
  telemetry:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.4
  micro:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "0.5625rem"
    fontWeight: 500
    lineHeight: 1.2
rounded:
  sm: "3px"
  pill: "9999px"
spacing:
  xs: "6px"
  sm: "12px"
  md: "16px"
  lg: "24px"
components:
  module:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: "16px"
  button-primary:
    backgroundColor: "{colors.ch-price-dim}"
    textColor: "{colors.ch-price}"
    rounded: "{rounded.sm}"
    padding: "6px 12px"
  toggle-lamp:
    backgroundColor: "{colors.seam-bright}"
    rounded: "{rounded.pill}"
    size: "6px"
---

# Design System: NVDA Instrument Wall

## Overview

**Creative North Star: "The Data-Center NOC"**

NVDA Instrument Wall reads as a rack of live NVIDIA instrumentation, not a stock-tracking web app. The governing idea: NVIDIA's own business is the silicon that runs data centers, so the product becomes the room you stand in to watch it — a network operations center wall, built from rack-panel modules, hairline seams, corner rivets, and monospace telemetry, each glowing with the one color that channel owns everywhere it appears. This direction was chosen over a literal "Bloomberg terminal" pastiche (too on-the-nose, the category's own rut) and over a generic light fintech card-grid (the predictable opposite) via the impeccable new-work concept-seed process, mode=operate, seed key `6c4b073e`.

The system is unapologetically dense and instrument-grade: nothing is decorative, every color means a specific data channel, and every panel is a bounded "module" with its own silkscreen-style label, the way an actual rack unit is labeled. Thai-language copy carries the full UI (IBM Plex Sans Thai, chosen specifically for complete Thai glyph coverage paired natively with Latin), while every number that represents a live measurement renders in IBM Plex Mono, because tabular monospace numerals are what a real instrument readout uses — this is measurement typography, not a "technical" costume.

**Key Characteristics:**
- Near-black graphite ground, never pure black, with a faint top-of-screen green glow implying a lit panel in a dark room.
- One named accent color per data channel (price, volume, RSI, MACD, alerts), held constant across every chart, legend, toggle, and lamp that touches that channel.
- Rack-panel "module" framing (hairline border + two corner rivets) is the one recurring container; there is no card-grid alternative container anywhere in the system.
- Monospace telemetry is reserved for real numbers and instrument labels; Thai body copy never renders in mono.

## Colors

Ground colors sit within a few steps of near-black; every hue that appears above them is a named data channel, never decorative.

### Primary
- **NVIDIA Green** (`#79b900`, token `ch-price`): the price channel. Live quote digits, the price-pane MA20 line, the "PRICE" annunciator lamp, active timeframe pill. This is the one color present the moment the app opens — chosen to match the brand green people already associate with NVIDIA, rather than a generic instrument amber.

### Secondary
- **Console Cyan** (`#3fc4d8`, token `ch-volume`): the volume channel. Volume histogram bars (opacity modulated for up/down day, never re-hued), the "MA" annunciator lamp.
- **Signal Violet** (`#b28cf2`, token `ch-rsi`): the RSI channel. RSI line, its module label, the "RSI" annunciator lamp.
- **Readout Teal** (`#2fd6a6`, token `ch-macd`): the MACD channel. MACD line, its module label, positive histogram bars, the "MACD" annunciator lamp.

### Tertiary
- **Annunciator Red** (`#ef4a4a`, token `ch-alert`): reserved for alert state only — lit alert lamps, the notification badge, the delete-alert hover state. Never used for anything that is not an alert or a destructive action, so it keeps its alarm meaning.
- **Session Amber** (`#e3a94b`, frontmatter `session-extended`): pre/post-market only — the shared PRE/AH session badge and the quote header's extended-hours wash. It is a market-state color, not a data channel: price moves always stay `up`/`down`, never amber.

### Neutral
- **Graphite Ground** (`#0a0c0f`, token `bg`): page background.
- **Raised Deck** (`#0f1216`, token `bg-raised`): sticky nav background, one step up from the ground.
- **Panel** (`#12151b` / `#161a21`, tokens `panel` / `panel-2`): the fill of every module and of nested surfaces inside a module (dropdowns, param popovers).
- **Seam** (`#262c35` / `#3a4250`, tokens `seam` / `seam-bright`): module borders, dividers, hover-brightened separators.
- **Signal White** (`#e8ecf1`, token `text-primary`): primary text and the most important telemetry values.
- **Panel Gray** (`#9aa4b2`, token `text-secondary`): body copy, secondary stats.
- **Recessed Gray** (`#5f6875`, token `text-muted`): module labels, placeholder/loading copy, timestamps.

### Named Rules
**The One Channel, One Color Rule.** A data channel's color never changes across contexts. If RSI is violet on the chart, it is violet in the toggle swatch, the annunciator lamp, and the analysis panel's "ด้านเทคนิค" section header. Introducing a second color for the same channel anywhere breaks the instrument-panel legibility the whole system depends on.

**The Alert Red Is Sacred Rule.** `ch-alert` red never appears for anything but an alert state or a destructive action (delete). It does not become a generic "error" red for unrelated form validation — if that need arises, use `down` (`#ef5b5b`) instead, which is already the bearish/negative-value color and reads as "negative," not "alarm."

## Typography

**Display Font:** IBM Plex Mono (with `ui-monospace, monospace` fallback)
**Body Font:** IBM Plex Sans Thai (with `Segoe UI, sans-serif` fallback)
**Label/Mono Font:** IBM Plex Mono, same family as Display

**Character:** IBM Plex Sans Thai carries every sentence of UI copy in natural Thai financial language, calm and legible at small sizes; IBM Plex Mono carries every number that represents a live measurement, giving the instrument-panel its "readout" feel. The two are never mixed within a single text run — a Thai label sits beside a mono value, they don't share a line.

### Hierarchy
- **Display** (500, 2rem / `text-[2rem]`, 1.1 line-height, mono; 1.75rem on phones): the live quote price in the compact cockpit header. The largest text on the dashboard, reserved for that one value.
- **Headline** (500, 1.125rem / `text-lg`, mono is not used here — Thai sans): page titles ("งบการเงิน NVIDIA", "ข่าว NVIDIA").
- **Title** (500, 0.875rem / `text-sm`): module content headers, nav labels, news headlines.
- **Body** (400, 0.75–0.875rem / `text-xs`–`text-sm`, 1.6 line-height): analysis prose, news summaries, table cells.
- **Label** (500, 0.625–0.6875rem / `text-[10px]`–`text-[11px]`, 0.14em tracking, uppercase, mono): the `.module-label` silkscreen legend at the top of every module ("บทวิเคราะห์สังเคราะห์", "รายได้รายไตรมาส"), annunciator lamp captions ("PRICE", "RSI").
- **Micro** (500, 0.5625rem / `text-[9px]`, mono): session badges and the smallest treemap labels. Used only where a fixed-width instrument caption has to survive inside a measured box; never for prose or standalone body copy.

### Named Rules
**The Measurement-Only Mono Rule.** Monospace type appears only where a number is a live measurement or a fixed-width instrument label needs it (module legends, telemetry digits, timestamps). It is never applied to Thai prose or headings for a "technical" look — that would be costume, not function.

## Layout

The dashboard is a full-bleed cockpit: no `max-width` cap and only an 8px outer gutter (`px-2 py-2`), matching the nav's own `px-2` so the instrument wall reads edge-to-edge instead of sitting in a centered column. At `xl` the page locks to the viewport (`xl:h-full` plus a `flex-1` grid) and does not scroll; the watchlist rail, chart, and inspector each manage their own overflow. The cockpit grid is a `180px` watchlist rail / fluid chart / `290px` inspector with a 12px gap — the chart is deliberately the largest surface by a wide margin. At `lg` it becomes two columns (`180px` rail + fluid chart) with the inspector spanning both columns beneath, and the chart keeps a `clamp(480px, calc(100dvh - 13rem), 880px)` height. Below `lg` the mobile app shell below takes over and the chart becomes full-height rather than the clamp.

Financials uses a `2 / 4` responsive grid of ratio cards and trend-bar modules that collapses to 2 then 1 columns. News and Alerts constrain to `max-w-3xl` — narrower, reading-oriented columns instead of the dashboard's instrument-wall width.

The top chrome is one sticky module-tab nav (`px-2`, `py-3` targets, 2px `ch-price` underline on the active tab) over a blurred raised-deck background. Symbol search and the notification bell sit at the right. On narrow viewports the nav scrolls horizontally (`overflow-x-auto`) rather than wrapping tab labels onto a second line, which would break Thai compound words mid-word.

The heatmap stays a single scrolling page rather than the locked cockpit: it uses the standard page container so the wall is framed by the page gutter. On `lg+` the primary sector overview uses `clamp(500px, calc(100dvh - 18rem), 820px)`, and the secondary stock detail keeps `clamp(520px, calc(100dvh - 17rem), 860px)`; both are tall enough to behave like a wall, bounded so the legend and footer do not fall below the fold on a laptop. Below `lg` the sector table and the stock list set their own height and the page scrolls normally.

### Mobile App Shell
Below `lg` the dashboard stops being a stacked desktop page and becomes a stock-app-style detail screen: the global rack nav is the top app bar, followed by a compact quote header, one full-height panel, and a four-item bottom tab bar (`กราฟ` / `วิเคราะห์` / `รายการ` / `AI`). The chart is the default tab and fills everything between the quote header and the bottom bar — the shell is exactly `calc(100dvh - 47px)` below the nav, and the chart section is the `flex-1` child, so it reads as a native full-screen chart rather than a card below the watchlist.

The quote header, chart, watchlist and inspector drop their module chrome below `lg` via `.module-mobile-flat` (transparent background, no border/radius/recess shadow, no rivets), leaving only the chart's own toolbar/readout seams. The chart, watchlist and inspector stay mounted and are toggled with display classes; switching tabs preserves chart zoom/settings and never refetches the analysis panels. The bottom bar includes `env(safe-area-inset-bottom)` padding, and the shell clips overflow while each panel scrolls internally.

The compact quote header keeps symbol/actions and price/change on two rows; company name, exchange badge, day-stat grid and timestamp are hidden below `lg`, while pre/post extended-hours rows remain. The `AI` tab opens the existing chat panel above the bottom bar instead of a floating trigger over the chart. The 1H price chart starts at 5 days on compact viewports and still widens by width toward the ~9px bar target; the analysis/compare views keep their fixed 20-day scope.

## Elevation & Depth

Flat-and-inset, not lifted. Modules do not float above the page on a drop shadow; they read as machined panels sunk very slightly into the rack, using a soft inset highlight plus a faint outer shadow (`inset 0 1px 0 rgba(255,255,255,0.03), inset 0 0 0 1px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.5)`). This keeps the surface calm at rest; nothing pops off the page.

### Shadow Vocabulary
- **Module recess** (`box-shadow: inset 0 1px 0 rgba(255,255,255,.03), inset 0 0 0 1px rgba(0,0,0,.4), 0 1px 2px rgba(0,0,0,.5)`): the one shadow treatment in the system, applied via the `.module` class to every panel.

### Named Rules
**The No-Float Rule.** Nothing in this system uses a lifted drop shadow to imply it is "above" the page. Depth comes from the module recess treatment only; hover/active states change border or text color, never elevation.

## Shapes

Corners are barely rounded (`3px`, `rounded-sm`) — enough to soften a rack panel's machined edge without turning it into a friendly rounded card. Two small circular "rivets" (3×3px dots via `.module::before` / `::after`) sit in the top corners of every module, the one recurring ornamental signature in the system, standing in for the screw heads of an actual mounted panel. Buttons, pills, and lamps use full pill radius (`rounded-full`) for anything that represents a discrete on/off state (toggles, lamps, badges) — the shape itself signals "indicator," distinct from the module's rack-panel corners.

## Components

### Buttons
- **Shape:** `rounded` (3px), matching module corners.
- **Primary** (e.g. "เพิ่มการแจ้งเตือน"): `ch-price-dim` background, `ch-price` text, `px-3 py-1.5`.
- **Toggle chip** (timeframe pills): transparent by default; the active timeframe gets `bg-ch-price-dim` + `text-ch-price`. Chart indicator toggles live in the `ตัวชี้วัด` popover as channel rows with a small switch and parameter fields, not as a strip of chips on the chart; the popover trigger reports the active channel count.
- **Ghost / destructive** (delete alert): icon-only, `text-text-muted` at rest, shifts to `text-ch-alert` on hover — the only place a neutral control turns alert-red on interaction.

### Chips / Lamps
- **Annunciator lamp:** 6×6px circle, `seam-bright` when unlit, channel color + matching glow (`box-shadow: 0 0 6px <channel color>`) plus a slow pulse animation (`lit`, 1.6s ease-in-out) when an unread notification exists for that channel.
- **Alert-active lamp** (Alerts page list): same treatment using `ch-alert`, tied to an alert's `active` boolean rather than a channel.

### Cards / Containers
- **Corner Style:** `rounded-sm` (3px).
- **Background:** `panel` (`#12151b`); nested surfaces (dropdowns, param popovers, table wrapper) step to `panel-2` (`#161a21`).
- **Shadow Strategy:** module recess only (see Elevation & Depth).
- **Border:** 1px `seam`, brightening to `seam-bright` only on interactive hover (chart pane separators).
- **Internal Padding:** `16px` (`p-4`) standard; toolbars and table cells use `12px`/`8px` (`px-3 py-2`) for denser rows.
- **Mobile shell:** below `lg`, dashboard panels use `.module-mobile-flat` instead of the rack-panel treatment, so the chart can run edge-to-edge between the compact quote header and the bottom tab bar. The modifier only applies at mobile widths; desktop keeps the full module treatment.

### Inputs / Fields
- **Style:** `panel-2` background, 1px `seam` border, `rounded-sm`, mono numerals for numeric fields (threshold, MA period).
- **Focus:** relies on the browser's native focus ring (never suppressed) — no custom glow, keeping keyboard navigation legible against the dark ground.

### Navigation
- **Style:** module-tab row, Thai labels at `text-sm` beside a 16px line icon; active tab gets a 2px `ch-price` underline and full-opacity `text-primary`; inactive tabs sit at `text-secondary` and lighten to `text-primary` on hover. Mobile: horizontal scroll, `whitespace-nowrap`, never wraps.
- **Dashboard bottom bar (mobile):** a four-column, safe-area-aware tab bar below `lg` — `กราฟ` / `วิเคราะห์` / `รายการ` / `AI` — with an 18px icon over a 10px label and a 2px `ch-price` top indicator on the selected content tab. `AI` is an action, not a content tab: it toggles the chat panel and takes the `ch-rsi` accent while open.

### Instrument Header
The full-width compact quote header (`px-4 py-2.5 lg:px-5`) carries the symbol/company, follow star, live price and change chip, day stats, and session wash. The data timestamp sits inline after the change chip at `xl` and drops beneath the price below `xl`, so the header stays one row on desktop without hiding freshness. It has no module title of its own; the symbol is the label. Below `lg` it becomes a two-row mobile header — symbol, follow star and bell/search on the first row; price and a one-line change chip on the second — and drops the company name, exchange badge, day-stat grid and timestamp to keep the chart full-screen. Pre/post extended-hours rows stay visible at every width.

### Chart View Switch
The chart module's header is a single row: a two-view segmented control (`กราฟราคา` / `เทียบตลาด`), a shared timeframe strip, and the active timeframe label. The compare view is mounted lazily on first open and kept alive afterwards; both views share the selected timeframe.

### Readout Strip
A one-line telemetry strip between the chart module's header and the canvas, separated by a half-strength seam (`border-seam/60`). All mono, `text-[11px]`: a muted field label followed by its value in `text-primary`, except values that belong to a channel (VOL, RSI, MACD), which take that channel's exact color, and the change value, which takes `up`/`down`. Follows the crosshair; with the pointer off the chart it reads the latest bar and says so — `· สด` when the shared quote poll has folded a live trade into that bar, `· ล่าสุด` when the bar is only the last fetched close — because an instrument readout is never blank: it shows the live value until you probe elsewhere. The right end holds the `ตัวชี้วัด` popover trigger, pinned outside the scroll area. On compact viewports the strip keeps time, close and change first (O/H/L and channel values follow in the scroll), and the live suffix is dropped so the close/change stay visible at phone width.

### Session Wash
Market state read as ambient color rather than a discrete badge, so it survives at every viewport without adding a chip to an already-tight header row: a `radial-gradient` anchored at the quote header module's top-left corner (`ellipse 340px 230px at 0% 0%`), 10%-alpha `up` green while the regular session trades, 10%-alpha amber (`#e3a94b`) in pre/post, no gradient at all when the market is shut — same "unlit lamp has no glow" rule as the Annunciator lamp, just painted as a wash instead of a dot. Stays under the price/name text in paint order and at 10% alpha specifically so it never competes with foreground contrast; the Thai session name is still available via a native tooltip (`title`) rather than repeated as on-screen text.

### Cockpit Rails
The left rail (`180px`) lists the owner's watchlist with logo, symbol, price and change; signed-out visitors see the public market board (`SPY` / `QQQ` / `DIA` / `IWM`), and the owner gets a dashed `เพิ่มหุ้น` action row. It is vertical at every width: on desktop it is the left cockpit rail, and below `lg` the same component becomes the full-height `รายการ` tab instead of a horizontal strip under the chart. The right inspector (`290px`) holds three tabs — `วิเคราะห์` / `นักวิเคราะห์` / `เหตุการณ์` — with all panels mounted and hidden so switching tabs never refetches; below `lg` it becomes the full-height `วิเคราะห์` tab. Both rails scroll independently; on desktop the inspector's scroll area reserves `pb-14` for the floating chat trigger, while mobile reaches the chat through the bottom `AI` tab.

### Market Heatmap
`/heatmap` is sector-first. The primary rack module is the eleven-industry ICB overview; the fixed 36-stock board is a secondary disclosure below it, opened by the disclosure row or by clicking a sector. Both are full-width rack modules, not a card grid.

The sector overview is a single-level squarified treemap at `lg+`: one block per Russell 1000 ICB industry, represented by its iShares U.S. sector ETF. Area is the industry's approximate Russell 1000 ICB weight from `heatmap-universe.ts` (a fixed classification table, not a live measurement); colour is the ETF's daily % change. There is no 2.5% floor here because the smallest real industry weight (Basic Materials, ~1.6%) is already large enough at laptop width. The scale is symmetric and capped at 1.5–3%; the legend prints the exact ± bound, and an outlier clips as stated. Labels appear progressively — sector name, ETF ticker, percentage, and market weight — with the type stepping up from 10px micro to `text-base` on the largest blocks and the percentage to `text-3xl`; a field is hidden at that size rather than clipped. A sector block is a button: clicking it opens the stock detail filtered to that sector. The toolbar carries the `SECTOR MAP` silkscreen label, the shared session badge, the 11-industry count, the legend, the as-of time, and a manual refresh. ICB puts Alphabet/Meta in Technology, media/entertainment in Consumer Discretionary, communications equipment in Telecommunications, and payment processors in Industrials; there is no Communication Services tile.

The stock detail is the existing two-level squarified treemap at `lg+`, now labelled `STOCK DETAIL`: sector blocks sized by total market cap and companies inside each block sized by their own cap. Sector weight carries a 2.5% floor so the smallest sector still gets a readable block; intra-sector weights stay raw, so the floor never distorts the company split. Sector headers are silkscreen captions — full Thai names on wide blocks, `ยูทิลิตี้` / `อสังหาฯ` on tight ones — with the sector's cap-weighted change at the right; the full name remains in the section's `aria-label` and the label's `title`. The header states the visible count and, when filtered, the sector name plus a `ดูทุกกลุ่ม` action; the unfiltered state says `36 หุ้นใหญ่ · ตัวอย่าง`. The disclosure row above it says the stock sample is not a market representative. The sample follows ICB assignments (Alphabet/Meta in Technology, Netflix in Consumer Discretionary, Visa/Mastercard in Industrials) and includes Verizon/AT&T/Cisco so Telecommunications has a drill-down.

Tile fill is the day's direction mixed into `panel-2`: `up` green above zero, `down` red below, flat at `panel-2` itself, and a dashed muted tile when the quote is missing. The stock detail's scale is symmetric and capped at the 2–6% bound the day requires; the sector overview's is capped at 1.5–3%. Both legends always print the exact ± bound, so a violent day clips as stated instead of silently washing out. The sign is printed in every percentage, so direction never depends on colour alone. Labels appear progressively as the box grows — in the stock detail, ticker down to a 24px sliver, percentage from 56px wide, company name from 110px, price from 94px, with type from 9px micro to `text-lg` on the largest tiles. A field is hidden at that size rather than clipped; a truncated `−0.9…` is not a readout.

#### The market map's stepped scale

The 500-tile map does **not** mix into `panel-2`. A smooth wash makes a −1.1% and a −1.4% company indistinguishable, and telling those two apart at a glance is the whole job of the board — so `marketChangeSurface` paints **six discrete steps per direction** plus a neutral, anchored on TradingView's own S&P 500 colours:

| Band (|%|) | Down | Up |
|---|---|---|---|
| < 0.2 | `#c9c9c9` (neutral) | same |
| 0.2 – 0.5 | `#f7b0b2` | `#8ed8b0` |
| 0.5 – 1 | `#f78a8e` | `#5fcb96` |
| 1 – 1.5 | `#f2636a` | `#35bc7c` |
| 1.5 – 2 | `#e8404b` | `#16a866` |
| 2 – 2.5 | `#c92c39` | `#067a48` |
| ≥ 2.5 | `#9b1f2b` | `#076637` |

A company that barely moved reads as a **light near-white grey**, not a faint red or green tint, so the eye goes straight to what actually moved. The bands are placed against the real distribution (median |change| ≈ 1.2%, p75 ≈ 2.2%), so the bulk of names land in the middle steps rather than piling into one.

Because a flat fill can be near-white, tile ink is computed per fill rather than fixed: `surfaceFor` picks dark or light text from the fill's WCAG relative luminance, switching at `L = 0.16` — the crossover solved from the two ink luminances, not an eyeballed 0.22, which would put light text on the mid red at a genuinely hard-to-read 3.4:1. Every labelled tile on the board now clears 4.5:1 (worst measured: 4.54:1).

The strip between toolbar and map follows the same instrument-readout pattern. In the sector overview it reports sector breadth (advancers, decliners, flat, missing), the sector-weight-weighted average, and the leader/laggard; hovering or focusing a sector replaces it with that sector's ETF, price in USD, change, and market weight. In the stock detail it reports the visible stock breadth, the cap-weighted average, and the leader/laggard; hovering or focusing a tile replaces it with that ticker's name, price in USD, change, market cap, and sector. Stock tiles link to `/dashboard/[symbol]` with prefetch off, so sweeping the wall doesn't fan out 36 navigations, and focus/blur drive the same readout as the pointer.

Below `lg` the sector treemap becomes a compact weight table: one row per sector, with the ETF, Thai name, a proportional weight bar, the exact weight, and the signed change. The stock treemap becomes the existing sector-grouped proportional list: each company keeps a width share of its row proportional to market cap (minimum 68px) but rows stay a fixed 56px tall, so tickers and percentages remain legible instead of shrinking into the mosaic; sector headers repeat the full label, company count, and cap-weighted change. Both mobile views use the same colour scales and detailed Thai `aria-label`s; the progressive multi-field label is a desktop-only affordance.

### S&P 500 Market Map (mobile)
`/heatmap`'s full-index board keeps all 500 tiles below `md`, structured like TradingView's own phone board rather than a scroll: `layoutMobileBoard` squarifies every sector onto one near-square canvas (the viewport width), so the two biggest sectors share the top row and the largest company really does sit top-left. Sector *area* still encodes its share of the index — the same rule as the desktop wall, just on a square canvas instead of a landscape one. A `0.8%` sector floor keeps the smallest groups (Miscellaneous, ~0.03%) from collapsing into a hairline; tiles inside a sector always use raw market caps.

500 tiles cannot all be readable at 342px, so the board is two levels: the overview is a mosaic of sector *buttons* (tile labels only render from `48×30`, below which a block stays a plain colour chip), and tapping a sector drills into that sector alone via `layoutMobileSector`, where every company gets the room its market cap earns. A `ทั้งหมด` back button returns to the overview. The section header row stays a fixed `13–20px` caption strip on the panel ground — not the desktop's filled header bar — so the coloured mosaic reads unbroken; the board keeps the desktop's `±3%` colour scale and progressive tile label, so no tile ever prints a clipped percentage.

The page heading and module silkscreen read `S&P 500 Index` (not `ฮีตแมป …`) — the board *is* the index, and the index name is what the owner looks for.

### Price Instrument Panel (signature component)
The centerpiece: a single `lightweight-charts` instance split into four native panes (price+overlays, volume, RSI, MACD) inside one module, so panning/zooming/crosshair stay synchronized across all four the way linked instrument channels would. Each pane's series use its channel's exact color; the candlestick pane's price scale is trimmed to a tight top/bottom margin (`0.08` / `0.02`) so candles fill their pane rather than floating in a mostly-empty scale, keeping the boundary between panes legible. Desktop pane stretch factors are `7 / 0.9 / 1.05 / 1.05`; the compact mobile chart uses `8 / 0.8 / 0.95 / 0.95`, giving the candles an even larger share of the full-height canvas while volume/RSI/MACD stay readable subordinate strips. The default 1H window is width-aware: desktop opens on 20 days and widens toward 28 days on large cockpits, targeting ~9px bars; compact viewports start at 5 days and use the same width target, so a phone never squeezes ~100 candles into ~340px. Range tabs keep their semantic window (1D is one day, 1M one month), and analysis/compare views keep the fixed 20-day 1H scope. Two bars of padding at each edge keep the first/last time labels from clipping, and support/resistance levels outside the visible price range are not drawn so their labels cannot pin to the time axis.

## Do's and Don'ts

### Do:
- **Do** keep one color per data channel constant across chart, legend, toggle, and lamp (see The One Channel, One Color Rule).
- **Do** use the `.module` rack-panel treatment (recess shadow + corner rivets) for every bounded content region; it is the system's only container.
- **Do** render live measurements in IBM Plex Mono with `tabular-nums`; render Thai UI copy in IBM Plex Sans Thai.
- **Do** write every error/empty state as a specific Thai sentence naming the problem and the recovery (e.g. missing API key names the env var and the fix), never a generic "something went wrong."
- **Do** let the nav scroll horizontally on narrow viewports rather than wrapping Thai labels onto a second line.
- **Do** keep the heatmap legend honest — print the exact ± bound in use and keep the sign on every percentage, so direction never relies on colour alone.
- **Do** hide a heatmap label field when its tile is too small for it; a clipped number is worse than an absent one.
- **Do** label the 36-stock detail as a sample, not a market representative; the sector overview is the market claim, and the stock board is a drill-down.

### Don't:
- **Don't** introduce a same-size icon+heading+text card grid anywhere; it is the category default this system explicitly refuses.
- **Don't** use `ch-alert` red for anything other than an alert state or a destructive action.
- **Don't** add a drop-shadow "lift" to a module; depth comes from the inset recess treatment only.
- **Don't** use monospace type for Thai prose, headings, or body copy — mono is reserved for measurements and instrument labels.
- **Don't** fabricate real price, financial, or news data anywhere in the shipped product; every number comes from the live Finnhub response or the UI shows an honest loading/empty/error state.
- **Don't** shrink either desktop treemap into the phone layout or give every tile an equal area — the sector map's area must keep encoding approximate market weight, and the stock detail's area must keep encoding market cap; the compact views use proportional lists for legibility.
