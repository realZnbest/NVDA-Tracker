import { NextResponse } from "next/server";
import { getEarningsCalendar, FinnhubError } from "@/lib/finnhub";
import { SYMBOL } from "@/lib/timeframes";

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  try {
    const now = new Date();
    const from = toDateStr(now);
    const to = toDateStr(new Date(now.getTime() + 180 * 24 * 60 * 60_000));
    const data = await getEarningsCalendar(SYMBOL, from, to);
    const todayStr = toDateStr(now);
    const upcoming = data.earningsCalendar
      .filter((e) => e.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    return NextResponse.json({ event: upcoming ?? null });
  } catch (err) {
    if (err instanceof FinnhubError && err.message === "MISSING_API_KEY") {
      return NextResponse.json({ error: "MISSING_API_KEY" }, { status: 200 });
    }
    return NextResponse.json({ error: "UNKNOWN_ERROR" }, { status: 200 });
  }
}
