import { ema, macd, rsi } from "./indicators";
import { addNotification, listAlerts, markAlertTriggered } from "./alerts-store";
import { ALERT_TYPE_LABEL_TH } from "./types";
import type { Alert, AlertNotification } from "./types";

const COOLDOWN_MS = 12 * 60 * 60 * 1000;

export interface MarketSnapshot {
  price: number;
  closes: number[];
}

function fmt(n: number) {
  return n.toLocaleString("th-TH", { maximumFractionDigits: 2 });
}

export async function evaluateAlerts(snapshot: MarketSnapshot): Promise<AlertNotification[]> {
  const alerts = (await listAlerts()).filter((a) => a.active);
  if (alerts.length === 0) return [];

  const { price, closes } = snapshot;
  const rsiSeries = rsi(closes, 14);
  const macdSeries = macd(closes);
  const ma50 = ema(closes, 50);
  const ma200 = ema(closes, 200);

  const lastRsi = rsiSeries[rsiSeries.length - 1];
  const macdLast = macdSeries.macd[macdSeries.macd.length - 1];
  const macdPrev = macdSeries.macd[macdSeries.macd.length - 2];
  const signalLast = macdSeries.signal[macdSeries.signal.length - 1];
  const signalPrev = macdSeries.signal[macdSeries.signal.length - 2];
  const ma50Last = ma50[ma50.length - 1];
  const ma50Prev = ma50[ma50.length - 2];
  const ma200Last = ma200[ma200.length - 1];
  const ma200Prev = ma200[ma200.length - 2];

  const fired: AlertNotification[] = [];

  const canFire = (alert: Alert) =>
    !alert.lastTriggeredAt || Date.now() - alert.lastTriggeredAt > COOLDOWN_MS;

  for (const alert of alerts) {
    if (!canFire(alert)) continue;
    let message: string | null = null;

    switch (alert.type) {
      case "price_above":
        if (alert.threshold !== null && price > alert.threshold) {
          message = `ราคา NVDA ทะลุ ${fmt(alert.threshold)} ดอลลาร์แล้ว (ล่าสุด ${fmt(price)})`;
        }
        break;
      case "price_below":
        if (alert.threshold !== null && price < alert.threshold) {
          message = `ราคา NVDA หลุด ${fmt(alert.threshold)} ดอลลาร์แล้ว (ล่าสุด ${fmt(price)})`;
        }
        break;
      case "rsi_overbought":
        if (lastRsi !== null && lastRsi > (alert.threshold ?? 70)) {
          message = `RSI เข้าเขตซื้อมากเกิน: ${fmt(lastRsi)} (เกณฑ์ ${alert.threshold ?? 70})`;
        }
        break;
      case "rsi_oversold":
        if (lastRsi !== null && lastRsi < (alert.threshold ?? 30)) {
          message = `RSI เข้าเขตขายมากเกิน: ${fmt(lastRsi)} (เกณฑ์ ${alert.threshold ?? 30})`;
        }
        break;
      case "macd_bullish_cross":
        if (
          macdLast !== null &&
          macdPrev !== null &&
          signalLast !== null &&
          signalPrev !== null &&
          macdPrev <= signalPrev &&
          macdLast > signalLast
        ) {
          message = `MACD ตัดขึ้นเหนือเส้นสัญญาณ — สัญญาณเชิงบวกระยะสั้น`;
        }
        break;
      case "macd_bearish_cross":
        if (
          macdLast !== null &&
          macdPrev !== null &&
          signalLast !== null &&
          signalPrev !== null &&
          macdPrev >= signalPrev &&
          macdLast < signalLast
        ) {
          message = `MACD ตัดลงใต้เส้นสัญญาณ — สัญญาณเชิงลบระยะสั้น`;
        }
        break;
      case "ma_golden_cross":
        if (
          ma50Last !== null &&
          ma50Prev !== null &&
          ma200Last !== null &&
          ma200Prev !== null &&
          ma50Prev <= ma200Prev &&
          ma50Last > ma200Last
        ) {
          message = `เกิด Golden Cross: MA50 ตัดขึ้นเหนือ MA200`;
        }
        break;
      case "ma_death_cross":
        if (
          ma50Last !== null &&
          ma50Prev !== null &&
          ma200Last !== null &&
          ma200Prev !== null &&
          ma50Prev >= ma200Prev &&
          ma50Last < ma200Last
        ) {
          message = `เกิด Death Cross: MA50 ตัดลงใต้ MA200`;
        }
        break;
    }

    if (message) {
      await markAlertTriggered(alert.id);
      fired.push(await addNotification(alert.id, `[${ALERT_TYPE_LABEL_TH[alert.type]}] ${message}`));
    }
  }

  return fired;
}
