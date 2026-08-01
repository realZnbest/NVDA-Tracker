export type TimeframeKey = "1D" | "1H" | "1W" | "1M" | "3M" | "1Y" | "5Y";

export const TIMEFRAMES: {
  key: TimeframeKey;
  label: string;
  yahooRange: string;
  yahooInterval: string;
}[] = [
  { key: "1D", label: "1 วัน", yahooRange: "1d", yahooInterval: "5m" },
  { key: "1H", label: "1 ชั่วโมง", yahooRange: "5d", yahooInterval: "60m" },
  { key: "1W", label: "1 สัปดาห์", yahooRange: "5d", yahooInterval: "15m" },
  { key: "1M", label: "1 เดือน", yahooRange: "1mo", yahooInterval: "60m" },
  { key: "3M", label: "3 เดือน", yahooRange: "3mo", yahooInterval: "1d" },
  { key: "1Y", label: "1 ปี", yahooRange: "1y", yahooInterval: "1d" },
  { key: "5Y", label: "5 ปี", yahooRange: "5y", yahooInterval: "1wk" },
];

export const SYMBOL = "NVDA";
