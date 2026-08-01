export type TimeframeKey = "1D" | "1W" | "1M" | "3M" | "1Y" | "5Y";

export const TIMEFRAMES: { key: TimeframeKey; label: string; resolution: string; days: number }[] = [
  { key: "1D", label: "1 วัน", resolution: "5", days: 1 },
  { key: "1W", label: "1 สัปดาห์", resolution: "30", days: 7 },
  { key: "1M", label: "1 เดือน", resolution: "60", days: 30 },
  { key: "3M", label: "3 เดือน", resolution: "D", days: 90 },
  { key: "1Y", label: "1 ปี", resolution: "D", days: 365 },
  { key: "5Y", label: "5 ปี", resolution: "W", days: 365 * 5 },
];

export const SYMBOL = "NVDA";
