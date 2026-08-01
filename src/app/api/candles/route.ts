import { NextRequest, NextResponse } from "next/server";
import { getYahooCandles } from "@/lib/yahoo";
import { SYMBOL, TIMEFRAMES, type TimeframeKey } from "@/lib/timeframes";

export async function GET(request: NextRequest) {
  const key = (request.nextUrl.searchParams.get("tf") ?? "3M") as TimeframeKey;
  const tf = TIMEFRAMES.find((t) => t.key === key) ?? TIMEFRAMES[3];

  try {
    const candles = await getYahooCandles(SYMBOL, tf.yahooRange, tf.yahooInterval);
    if (candles.s !== "ok") {
      return NextResponse.json({ error: "NO_DATA", detail: candles.s }, { status: 200 });
    }
    return NextResponse.json({ candles });
  } catch {
    return NextResponse.json({ error: "CANDLES_UNAVAILABLE" }, { status: 200 });
  }
}
