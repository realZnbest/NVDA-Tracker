import { NextRequest, NextResponse } from "next/server";
import { getEarningsCalendar, getEarningsSurprises, FinnhubError } from "@/lib/finnhub";
import { SYMBOL } from "@/lib/timeframes";

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol") ?? SYMBOL;
  try {
    const now = new Date();
    const from = toDateStr(now);
    const to = toDateStr(new Date(now.getTime() + 180 * 24 * 60 * 60_000));
    const [data, surprises] = await Promise.all([
      getEarningsCalendar(symbol, from, to),
      // Past results are a bonus; the countdown must still render if this call fails.
      getEarningsSurprises(symbol).catch(() => []),
    ]);
    // Finnhub lists the same fiscal period under more than one year/quarter label.
    const seen = new Set<string>();
    const history = surprises
      .filter((e) => e.actual !== null && e.estimate !== null)
      .sort((a, b) => b.period.localeCompare(a.period))
      .filter((e) => !seen.has(e.period) && seen.add(e.period))
      .slice(0, 4);
    const todayStr = toDateStr(now);
    const upcoming = data.earningsCalendar
      .filter((e) => e.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    return NextResponse.json({ event: upcoming ?? null, history });
  } catch (err) {
    if (err instanceof FinnhubError && err.message === "MISSING_API_KEY") {
      return NextResponse.json({ error: "MISSING_API_KEY" }, { status: 200 });
    }
    return NextResponse.json({ error: "UNKNOWN_ERROR" }, { status: 200 });
  }
}
