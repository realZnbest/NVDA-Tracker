import { ema, macd, rsi } from "./indicators";
import { addNotification, listAlerts, listPortfolioAlerts, markAlertTriggered } from "./alerts-store";
import { computePositionMetrics, type AggregatePosition } from "./position";
import { ALERT_TYPE_LABEL_TH } from "./types";
import type { Alert, AlertNotification } from "./types";
import { sendAlertEmail } from "./email";

const COOLDOWN_MS = 12 * 60 * 60 * 1000;

export interface SymbolMarketSnapshot {
  symbol: string;
  price: number;
  closes: number[];
  position: AggregatePosition | null;
}

export interface PortfolioSnapshot {
  totalValue: number;
  totalCost: number;
}

function fmt(n: number) {
  return n.toLocaleString("th-TH", { maximumFractionDigits: 2 });
}

const canFire = (alert: Alert) =>
  !alert.lastTriggeredAt || Date.now() - alert.lastTriggeredAt > COOLDOWN_MS;

async function fire(alert: Alert, scopeLabel: string, message: string): Promise<AlertNotification> {
  await markAlertTriggered(alert.id);
  const fullMessage = `[${scopeLabel} · ${ALERT_TYPE_LABEL_TH[alert.type]}] ${message}`;
  const notification = await addNotification(alert.id, fullMessage);
  void sendAlertEmail(alert.label, fullMessage);
  return notification;
}

async function evaluateSymbolAlerts(snapshot: SymbolMarketSnapshot): Promise<AlertNotification[]> {
  const alerts = (await listAlerts(snapshot.symbol)).filter((a) => a.active);
  if (alerts.length === 0) return [];

  const { symbol, price, closes, position } = snapshot;
  const pnlPercent = position ? computePositionMetrics(position, price).unrealizedPnlPercent : null;
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

  for (const alert of alerts) {
    if (!canFire(alert)) continue;
    let message: string | null = null;

    switch (alert.type) {
      case "price_above":
        if (alert.threshold !== null && price > alert.threshold) {
          message = `ราคา ${symbol} ทะลุ ${fmt(alert.threshold)} ดอลลาร์แล้ว (ล่าสุด ${fmt(price)})`;
        }
        break;
      case "price_below":
        if (alert.threshold !== null && price < alert.threshold) {
          message = `ราคา ${symbol} หลุด ${fmt(alert.threshold)} ดอลลาร์แล้ว (ล่าสุด ${fmt(price)})`;
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
      case "pnl_percent_above":
        if (pnlPercent !== null && alert.threshold !== null && pnlPercent > alert.threshold) {
          message = `กำไรถึง ${fmt(pnlPercent)}% แล้ว (เกณฑ์ ${alert.threshold}%)`;
        }
        break;
      case "pnl_percent_below":
        if (pnlPercent !== null && alert.threshold !== null && pnlPercent < alert.threshold) {
          message = `ขาดทุนถึง ${fmt(pnlPercent)}% แล้ว (เกณฑ์ ${alert.threshold}%)`;
        }
        break;
      // portfolio-wide types never appear here — listAlerts(symbol) only returns
      // rows with a matching symbol, and portfolio alerts have symbol = null.
    }

    if (message) {
      fired.push(await fire(alert, symbol, message));
    }
  }

  return fired;
}

async function evaluatePortfolioAlerts(portfolio: PortfolioSnapshot): Promise<AlertNotification[]> {
  const alerts = (await listPortfolioAlerts()).filter((a) => a.active);
  if (alerts.length === 0) return [];

  const pnlPercent =
    portfolio.totalCost === 0 ? 0 : ((portfolio.totalValue - portfolio.totalCost) / portfolio.totalCost) * 100;

  const fired: AlertNotification[] = [];
  for (const alert of alerts) {
    if (!canFire(alert)) continue;
    let message: string | null = null;

    if (alert.type === "portfolio_pnl_percent_above") {
      if (alert.threshold !== null && pnlPercent > alert.threshold) {
        message = `พอร์ตรวมกำไรถึง ${fmt(pnlPercent)}% แล้ว (เกณฑ์ ${alert.threshold}%)`;
      }
    } else if (alert.type === "portfolio_pnl_percent_below") {
      if (alert.threshold !== null && pnlPercent < alert.threshold) {
        message = `พอร์ตรวมขาดทุนถึง ${fmt(pnlPercent)}% แล้ว (เกณฑ์ ${alert.threshold}%)`;
      }
    }

    if (message) {
      fired.push(await fire(alert, "พอร์ตรวม", message));
    }
  }
  return fired;
}

/**
 * Evaluates every symbol's alerts against that symbol's own market snapshot, then
 * separately evaluates portfolio-wide P&L alerts against the combined position across
 * all symbols. `portfolio` is null when there are no open positions anywhere (nothing
 * for a portfolio-wide P&L alert to evaluate against).
 */
export async function evaluateAlerts(
  symbolSnapshots: SymbolMarketSnapshot[],
  portfolio: PortfolioSnapshot | null
): Promise<AlertNotification[]> {
  const perSymbolResults = await Promise.all(symbolSnapshots.map(evaluateSymbolAlerts));
  const portfolioResults = portfolio ? await evaluatePortfolioAlerts(portfolio) : [];
  return [...perSymbolResults.flat(), ...portfolioResults];
}
