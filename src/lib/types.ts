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
