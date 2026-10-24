export type AlertType =
  | "price_above"
  | "price_below"
  | "rsi_overbought"
  | "rsi_oversold"
  | "macd_bullish_cross"
  | "macd_bearish_cross"
  | "ma_golden_cross"
  | "ma_death_cross"
  | "pnl_percent_above"
  | "pnl_percent_below"
  | "portfolio_pnl_percent_above"
  | "portfolio_pnl_percent_below";

export const PORTFOLIO_ALERT_TYPES: AlertType[] = [
  "portfolio_pnl_percent_above",
  "portfolio_pnl_percent_below",
];

export interface Alert {
  id: string;
  /** null only for portfolio-wide alert types — every per-symbol alert has a symbol. */
  symbol: string | null;
  type: AlertType;
  label: string;
  threshold: number | null;
  fastPeriod: number | null;
  slowPeriod: number | null;
  active: boolean;
  createdAt: number;
  lastTriggeredAt: number | null;
}

export interface AlertNotification {
  id: string;
  alertId: string;
  message: string;
  createdAt: number;
  readAt: number | null;
}

export type MarketSession = "pre" | "regular" | "post" | "closed";

export const MAX_WATCHLIST_ITEMS = 30;
/** Tickers can contain dots (BRK.B), dashes (BTC-USD), index carets (^GSPC) and
 *  vendor suffixes (EURUSD=X); keep the shape tight so arbitrary strings never reach
 *  Turso or a provider URL. */
export const WATCHLIST_SYMBOL_PATTERN = /^[A-Z0-9^][A-Z0-9.^=-]{0,19}$/;

/** A symbol the owner follows, but does not necessarily hold. Kept separate from
 *  position lots so "interested in" and "own" stay independent concepts. */
export interface WatchlistItem {
  symbol: string;
  name: string;
  sortOrder: number;
  createdAt: number;
}

/** Trimmed quote shape for the watchlist table — a subset of FinnhubQuote so the
 *  client doesn't need to know about provider-specific fields. */
export interface WatchlistQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  time: number;
}

/** Intraday sparkline plus the extended-hours print for one watchlist row. Fetched on a
 *  slower cadence than quotes (see /api/watchlist/market) because the shape of the day
 *  and the after-hours print don't need a per-minute refresh. */
export interface WatchlistMarket {
  session: "pre" | "regular" | "post" | "closed";
  pre: { price: number; change: number; changePercent: number } | null;
  post: { price: number; change: number; changePercent: number } | null;
  sparkline: number[];
}

/** One tile in the public market heatmap. `marketCap` is in whole US dollars; null
 *  when Finnhub's profile endpoint is unavailable, in which case the UI falls back to
 *  a median size rather than inventing a valuation. */
export interface HeatmapTile {
  symbol: string;
  name: string;
  sector: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  marketCap: number | null;
  currency: string;
  time: number | null;
}

export interface HeatmapResponse {
  tiles: HeatmapTile[];
  asOf: number;
  session: MarketSession;
  /** Symbols whose quote could not be fetched this round; they still render, blank. */
  failedSymbols: string[];
  /** False when no market cap could be loaded at all (e.g. FINNHUB_API_KEY missing). */
  marketCapAvailable: boolean;
}

/** One company tile in the full S&P 500 market map. The scanner supplies the company's
 *  TradingView sector/industry and logo, so the map can be grouped without a second
 *  classification table. `time` is the last-trade time in Unix seconds. */
export interface MarketHeatmapTile extends HeatmapTile {
  exchange: string;
  industry: string;
  logoUrl: string | null;
  updateMode: string | null;
}

/** Full S&P 500 heatmap response. `dataTime` is the scanner's last-trade time; `asOf`
 *  is when this server assembled the response. `delayedMinutes` is parsed from the
 *  scanner's update mode, so the UI can say how delayed the feed is instead of
 *  presenting it as live. */
export interface MarketHeatmapResponse {
  tiles: MarketHeatmapTile[];
  asOf: number;
  dataTime: number | null;
  session: MarketSession;
  source: "TradingView";
  delayedMinutes: number | null;
  failedSymbols: string[];
}

/** One sector in the public market overview. `marketWeight` is the sector's approximate
 *  share of the Russell 1000 (ICB) in percent; it sizes the sector block and weights the
 *  market average. Price and change come from the sector's iShares U.S. sector ETF. */
export interface SectorTile {
  id: string;
  label: string;
  shortLabel: string;
  etf: string;
  marketWeight: number;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  time: number | null;
}

export interface SectorHeatmapResponse {
  sectors: SectorTile[];
  asOf: number;
  session: MarketSession;
  /** ETF symbols whose quote could not be fetched this round; they still render, blank. */
  failedSymbols: string[];
}

export const ALERT_TYPE_LABEL_TH: Record<AlertType, string> = {
  price_above: "ราคาสูงกว่า",
  price_below: "ราคาต่ำกว่า",
  rsi_overbought: "RSI เข้าเขตซื้อมากเกิน (Overbought)",
  rsi_oversold: "RSI เข้าเขตขายมากเกิน (Oversold)",
  macd_bullish_cross: "MACD ตัดขึ้น (สัญญาณขาขึ้น)",
  macd_bearish_cross: "MACD ตัดลง (สัญญาณขาลง)",
  ma_golden_cross: "Golden Cross (MA เร็วตัดขึ้นเหนือ MA ช้า)",
  ma_death_cross: "Death Cross (MA เร็วตัดลงใต้ MA ช้า)",
  pnl_percent_above: "กำไรถึง (%)",
  pnl_percent_below: "ขาดทุนถึง (%)",
  portfolio_pnl_percent_above: "พอร์ตรวมกำไรถึง (%)",
  portfolio_pnl_percent_below: "พอร์ตรวมขาดทุนถึง (%)",
};
