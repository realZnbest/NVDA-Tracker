import { NextResponse } from "next/server";
import { getQuote, FinnhubError } from "@/lib/finnhub";
import { getYahooCandles } from "@/lib/yahoo";
import { SYMBOL } from "@/lib/timeframes";
import { evaluateAlerts } from "@/lib/evaluate-alerts";
import { requireAlertsAuth } from "@/lib/alerts-auth";

export async function POST() {
  const unauth = await requireAlertsAuth();
  if (unauth) return unauth;
  try {
    const [candles, quote] = await Promise.all([
      getYahooCandles(SYMBOL, "2y", "1d"),
      getQuote(SYMBOL),
    ]);
    if (candles.s !== "ok" || candles.c.length < 30) {
      return NextResponse.json({ fired: [] });
    }
    const fired = await evaluateAlerts({ price: quote.c, closes: candles.c });
    return NextResponse.json({ fired });
  } catch (err) {
    if (err instanceof FinnhubError) {
      return NextResponse.json({ error: err.message }, { status: 200 });
    }
    return NextResponse.json({ error: "UNKNOWN_ERROR" }, { status: 500 });
  }
}
