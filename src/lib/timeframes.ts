export type TimeframeKey =
  | "1H"
  | "1D"
  | "5D"
  | "1W"
  | "1M"
  | "3M"
  | "6M"
  | "YTD"
  | "1Y"
  | "5Y";

export interface Timeframe {
  key: TimeframeKey;
  label: string;
  /** Range/interval used to FETCH data — maximized per interval so zooming out reveals real history, not a dead edge. */
  yahooRange: string;
  yahooInterval: string;
  /** How many days back the chart is scoped to by default when this tab is selected; "ytd" = Jan 1 of the current year. */
  scopeDays: number | "ytd";
}

export const TIMEFRAMES: Timeframe[] = [
  // Yahoo hard limit: 60m/1h bars are only available for the last 730 days.
  { key: "1H", label: "1 ชั่วโมง", yahooRange: "2y", yahooInterval: "60m", scopeDays: 5 },
  // Yahoo hard limit: 5m bars are only available for roughly the last 60 days.
  { key: "1D", label: "1 วัน", yahooRange: "60d", yahooInterval: "5m", scopeDays: 1 },
  { key: "5D", label: "5 วัน", yahooRange: "60d", yahooInterval: "30m", scopeDays: 5 },
  { key: "1W", label: "1 สัปดาห์", yahooRange: "60d", yahooInterval: "15m", scopeDays: 7 },
  { key: "1M", label: "1 เดือน", yahooRange: "2y", yahooInterval: "60m", scopeDays: 30 },
  // Yahoo silently coarsens daily bars to monthly once the range gets too large (e.g. "max");
  // 30y stays daily and covers NVDA's full trading history (IPO: 1999-01-22).
  { key: "3M", label: "3 เดือน", yahooRange: "30y", yahooInterval: "1d", scopeDays: 90 },
  { key: "6M", label: "6 เดือน", yahooRange: "30y", yahooInterval: "1d", scopeDays: 182 },
  { key: "YTD", label: "ตั้งแต่ต้นปี", yahooRange: "30y", yahooInterval: "1d", scopeDays: "ytd" },
  { key: "1Y", label: "1 ปี", yahooRange: "30y", yahooInterval: "1d", scopeDays: 365 },
  { key: "5Y", label: "5 ปี", yahooRange: "30y", yahooInterval: "1wk", scopeDays: 365 * 5 },
];

export const SYMBOL = "NVDA";
