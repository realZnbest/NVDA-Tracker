import { NextRequest, NextResponse } from "next/server";
import { getQuote, FinnhubError } from "@/lib/finnhub";
import { getExtendedHoursQuote } from "@/lib/yahoo";
import { SYMBOL } from "@/lib/timeframes";
import { subscribeSymbol, getLiveTick } from "@/lib/finnhub-ws";

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol") ?? SYMBOL;
  subscribeSymbol(symbol);
  try {
    const restQuote = await getQuote(symbol);
    // `restQuote` is a shared cache entry (see finnhub.ts) — copy before overlaying a
    // fresher trade print rather than mutating it out from under other callers.
    const tick = getLiveTick(symbol);
    const quote =
      tick && tick.time > restQuote.t * 1000
        ? {
            ...restQuote,
            c: tick.price,
            t: Math.floor(tick.time / 1000),
            d: tick.price - restQuote.pc,
            dp: restQuote.pc ? ((tick.price - restQuote.pc) / restQuote.pc) * 100 : 0,
          }
        : restQuote;
    let extended: Awaited<ReturnType<typeof getExtendedHoursQuote>> | null = null;
    try {
      extended = await getExtendedHoursQuote(symbol);
    } catch {
      // extended-hours data is best-effort; the regular quote still stands without it
    }
    return NextResponse.json({ quote, extended });
  } catch (err) {
    if (err instanceof FinnhubError) {
      return NextResponse.json({ error: err.message }, { status: 200 });
    }
    return NextResponse.json({ error: "UNKNOWN_ERROR" }, { status: 500 });
  }
}
