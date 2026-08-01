import { NextResponse } from "next/server";
import { getQuote, FinnhubError } from "@/lib/finnhub";
import { getExtendedHoursQuote } from "@/lib/yahoo";
import { SYMBOL } from "@/lib/timeframes";

export async function GET() {
  try {
    const quote = await getQuote(SYMBOL);
    let extended: Awaited<ReturnType<typeof getExtendedHoursQuote>> | null = null;
    try {
      extended = await getExtendedHoursQuote(SYMBOL);
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
