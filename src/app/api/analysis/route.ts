import { NextRequest, NextResponse } from "next/server";
import { FinnhubError } from "@/lib/finnhub";
import { AnalysisDataError, getAnalysisRead } from "@/lib/analysis";
import { SYMBOL, type TimeframeKey } from "@/lib/timeframes";

export async function GET(request: NextRequest) {
  const tf = (request.nextUrl.searchParams.get("tf") ?? "1H") as TimeframeKey;
  const symbol = request.nextUrl.searchParams.get("symbol") ?? SYMBOL;
  try {
    const read = await getAnalysisRead(tf, symbol);
    return NextResponse.json({ read });
  } catch (err) {
    if (err instanceof AnalysisDataError) {
      return NextResponse.json({ error: err.message }, { status: 200 });
    }
    if (err instanceof FinnhubError) {
      return NextResponse.json({ error: err.message }, { status: 200 });
    }
    return NextResponse.json({ error: "UNKNOWN_ERROR" }, { status: 500 });
  }
}
