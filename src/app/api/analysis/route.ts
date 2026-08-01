import { NextResponse } from "next/server";
import { getBasicFinancials, getCandles, getQuote, FinnhubError } from "@/lib/finnhub";
import { SYMBOL } from "@/lib/timeframes";
import { bollinger, ema, lastValid, macd, rsi, sma } from "@/lib/indicators";
import { synthesize } from "@/lib/analysis";

export async function GET() {
  const to = Math.floor(Date.now() / 1000);
  const from = to - 400 * 24 * 60 * 60;

  try {
    const [candles, quote, financials] = await Promise.all([
      getCandles(SYMBOL, "D", from, to),
      getQuote(SYMBOL),
      getBasicFinancials(SYMBOL),
    ]);

    if (candles.s !== "ok" || candles.c.length < 30) {
      return NextResponse.json({ error: "NO_DATA" }, { status: 200 });
    }

    const closes = candles.c;
    const price = quote.c;
    const rsiSeries = rsi(closes, 14);
    const macdSeries = macd(closes);
    const ma20 = sma(closes, 20);
    const ma50 = ema(closes, 50);
    const ma200 = ema(closes, 200);
    const bb = bollinger(closes, 20);
    const m = financials.metric;

    const read = synthesize(
      {
        price,
        rsi: lastValid(rsiSeries),
        macd: lastValid(macdSeries.macd),
        macdSignal: lastValid(macdSeries.signal),
        macdHistPrev: macdSeries.histogram[macdSeries.histogram.length - 2] ?? null,
        macdHistLast: macdSeries.histogram[macdSeries.histogram.length - 1] ?? null,
        ma20: lastValid(ma20),
        ma50: lastValid(ma50),
        ma200: lastValid(ma200),
        bollingerUpper: lastValid(bb.upper),
        bollingerLower: lastValid(bb.lower),
      },
      {
        peTTM: m.peNormalizedAnnual ?? m.peTTM ?? null,
        psTTM: m.psTTM ?? null,
        netMarginTTM: m.netProfitMarginTTM ?? null,
        grossMarginTTM: m.grossMarginTTM ?? null,
        revenueGrowthYoY: m.revenueGrowthTTMYoy ?? m.revenueGrowthQuarterlyYoy ?? null,
        epsGrowthYoY: m.epsGrowthTTMYoy ?? m.epsGrowthQuarterlyYoy ?? null,
        week52High: m["52WeekHigh"] ?? null,
        week52Low: m["52WeekLow"] ?? null,
        price,
      }
    );

    return NextResponse.json({ read });
  } catch (err) {
    if (err instanceof FinnhubError) {
      return NextResponse.json({ error: err.message }, { status: 200 });
    }
    return NextResponse.json({ error: "UNKNOWN_ERROR" }, { status: 500 });
  }
}
