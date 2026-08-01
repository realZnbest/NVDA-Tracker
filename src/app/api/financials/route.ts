import { NextResponse } from "next/server";
import { getBasicFinancials, getReportedFinancials, FinnhubError } from "@/lib/finnhub";
import { SYMBOL } from "@/lib/timeframes";

export async function GET() {
  try {
    const [reported, metrics] = await Promise.all([
      getReportedFinancials(SYMBOL, "quarterly"),
      getBasicFinancials(SYMBOL),
    ]);
    return NextResponse.json({ reported, metrics: metrics.metric });
  } catch (err) {
    if (err instanceof FinnhubError) {
      return NextResponse.json({ error: err.message }, { status: 200 });
    }
    return NextResponse.json({ error: "UNKNOWN_ERROR" }, { status: 500 });
  }
}
