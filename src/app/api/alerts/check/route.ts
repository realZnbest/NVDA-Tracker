import { NextResponse } from "next/server";
import { getCandles, getQuote, FinnhubError } from "@/lib/finnhub";
import { SYMBOL } from "@/lib/timeframes";
import { evaluateAlerts } from "@/lib/evaluate-alerts";

export async function POST() {
  const to = Math.floor(Date.now() / 1000);
  const from = to - 400 * 24 * 60 * 60;

  try {
    const [candles, quote] = await Promise.all([
      getCandles(SYMBOL, "D", from, to),
      getQuote(SYMBOL),
    ]);
    if (candles.s !== "ok" || candles.c.length < 30) {
      return NextResponse.json({ fired: [] });
    }
    const fired = evaluateAlerts({ price: quote.c, closes: candles.c });
    return NextResponse.json({ fired });
  } catch (err) {
    if (err instanceof FinnhubError) {
      return NextResponse.json({ error: err.message }, { status: 200 });
    }
    return NextResponse.json({ error: "UNKNOWN_ERROR" }, { status: 500 });
  }
}
