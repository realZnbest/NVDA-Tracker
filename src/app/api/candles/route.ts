import { NextRequest, NextResponse } from "next/server";
import { getCandles, FinnhubError } from "@/lib/finnhub";
import { SYMBOL, TIMEFRAMES, type TimeframeKey } from "@/lib/timeframes";

export async function GET(request: NextRequest) {
  const key = (request.nextUrl.searchParams.get("tf") ?? "3M") as TimeframeKey;
  const tf = TIMEFRAMES.find((t) => t.key === key) ?? TIMEFRAMES[3];

  const to = Math.floor(Date.now() / 1000);
  const from = to - tf.days * 24 * 60 * 60;

  try {
    const candles = await getCandles(SYMBOL, tf.resolution, from, to);
    if (candles.s !== "ok") {
      return NextResponse.json(
        { error: "NO_DATA", detail: candles.s },
        { status: 200 }
      );
    }
    return NextResponse.json({ candles });
  } catch (err) {
    if (err instanceof FinnhubError) {
      return NextResponse.json({ error: err.message }, { status: 200 });
    }
    return NextResponse.json({ error: "UNKNOWN_ERROR" }, { status: 500 });
  }
}
