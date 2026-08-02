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
