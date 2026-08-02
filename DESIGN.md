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
typography:
  display:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "2.25rem"
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
- **Display** (500, 2.25rem / `text-4xl`, 1.1 line-height, mono): the live NVDA quote price. The single largest text on the page, reserved for that one value.
- **Headline** (500, 1.125rem / `text-lg`, mono is not used here — Thai sans): page titles ("งบการเงิน NVIDIA", "ข่าว NVIDIA").
- **Title** (500, 0.875rem / `text-sm`): module content headers, nav labels, news headlines.
- **Body** (400, 0.75–0.875rem / `text-xs`–`text-sm`, 1.6 line-height): analysis prose, news summaries, table cells.
- **Label** (500, 0.625–0.6875rem / `text-[10px]`–`text-[11px]`, 0.14em tracking, uppercase, mono): the `.module-label` silkscreen legend at the top of every module ("บทวิเคราะห์สังเคราะห์", "รายได้รายไตรมาส"), annunciator lamp captions ("PRICE", "RSI").

### Named Rules
**The Measurement-Only Mono Rule.** Monospace type appears only where a number is a live measurement or a fixed-width instrument label needs it (module legends, telemetry digits, timestamps). It is never applied to Thai prose or headings for a "technical" look — that would be costume, not function.

## Layout

The page is a stack of rack modules inside a `max-w-[1400px]` centered container with `p-4` outer padding and `gap-4` between modules — the same rhythm used for outer page padding, module internal padding, and the gap between sibling modules, so the grid reads as one consistent unit of space rather than several competing scales.

Dashboard uses a `[1fr_360px]` two-column split above the `xl` breakpoint (price module + analysis module side by side), collapsing to a single stacked column below it. Financials uses a `2 / 4` responsive grid of ratio cards and trend-bar modules that collapses to 2 then 1 columns. News and Alerts constrain to `max-w-3xl` — narrower, reading-oriented columns instead of the dashboard's instrument-wall width.

The top chrome is two stacked bars: a thin **annunciator strip** (channel lamps + notification bell, `py-1.5`) sits above the **module-tab nav** (`py-3` targets, underline-on-active). Both are sticky (`sticky top-0`) over a blurred raised-deck background so the instrument wall's "control desk" stays present while a long page scrolls beneath it. On narrow viewports the nav scrolls horizontally (`overflow-x-auto`) rather than wrapping tab labels onto a second line, which would break Thai compound words mid-word.

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
- **Toggle chip** (chart indicator toggles, timeframe pills): transparent by default; active state gets `bg-ch-price-dim` + `text-ch-price` (timeframe) or full opacity + a colored square swatch (indicator toggles). Inactive toggles drop to 40% opacity rather than disappearing, so the full instrument set stays visible even when off.
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

### Inputs / Fields
- **Style:** `panel-2` background, 1px `seam` border, `rounded-sm`, mono numerals for numeric fields (threshold, MA period).
- **Focus:** relies on the browser's native focus ring (never suppressed) — no custom glow, keeping keyboard navigation legible against the dark ground.

### Navigation
- **Style:** module-tab row, Thai labels at `text-sm` beside a 16px line icon; active tab gets a 2px `ch-price` underline and full-opacity `text-primary`; inactive tabs sit at `text-secondary` and lighten to `text-primary` on hover. Mobile: horizontal scroll, `whitespace-nowrap`, never wraps.

### Readout Strip
A one-line telemetry bar directly beneath the chart toolbar, separated by a half-strength seam (`border-seam/60`). All mono, `text-[11px]`: a muted field label followed by its value in `text-primary`, except values that belong to a channel (VOL, RSI, MACD), which take that channel's exact color, and the change value, which takes `up`/`down`. Follows the crosshair; with the pointer off the chart it reads the latest bar and says so (`· ล่าสุด` in `ch-price`), because an instrument readout is never blank — it shows the live value until you probe elsewhere. Last-refresh time sits right-aligned in `text-muted`, the quiet proof the panel is still live.

### Session Wash
Market state read as ambient color rather than a discrete badge, so it survives at every viewport without adding a chip to an already-tight header row: a `radial-gradient` anchored at the quote header module's top-left corner (`ellipse 340px 230px at 0% 0%`), 10%-alpha `up` green while the regular session trades, 10%-alpha amber (`#e3a94b`) in pre/post, no gradient at all when the market is shut — same "unlit lamp has no glow" rule as the Annunciator lamp, just painted as a wash instead of a dot. Stays under the price/name text in paint order and at 10% alpha specifically so it never competes with foreground contrast; the Thai session name is still available via a native tooltip (`title`) rather than repeated as on-screen text.

### Price Instrument Panel (signature component)
The centerpiece: a single `lightweight-charts` instance split into four native panes (price+overlays, volume, RSI, MACD) inside one module, so panning/zooming/crosshair stay synchronized across all four the way linked instrument channels would. Each pane's series use its channel's exact color; the candlestick pane's price scale is trimmed to a tight top/bottom margin (`0.08` / `0.02`) so candles fill their pane rather than floating in a mostly-empty scale, keeping the boundary between panes legible.

## Do's and Don'ts

### Do:
- **Do** keep one color per data channel constant across chart, legend, toggle, and lamp (see The One Channel, One Color Rule).
- **Do** use the `.module` rack-panel treatment (recess shadow + corner rivets) for every bounded content region; it is the system's only container.
- **Do** render live measurements in IBM Plex Mono with `tabular-nums`; render Thai UI copy in IBM Plex Sans Thai.
- **Do** write every error/empty state as a specific Thai sentence naming the problem and the recovery (e.g. missing API key names the env var and the fix), never a generic "something went wrong."
- **Do** let the nav scroll horizontally on narrow viewports rather than wrapping Thai labels onto a second line.

### Don't:
- **Don't** introduce a same-size icon+heading+text card grid anywhere; it is the category default this system explicitly refuses.
- **Don't** use `ch-alert` red for anything other than an alert state or a destructive action.
- **Don't** add a drop-shadow "lift" to a module; depth comes from the inset recess treatment only.
- **Don't** use monospace type for Thai prose, headings, or body copy — mono is reserved for measurements and instrument labels.
- **Don't** fabricate real price, financial, or news data anywhere in the shipped product; every number comes from the live Finnhub response or the UI shows an honest loading/empty/error state.
