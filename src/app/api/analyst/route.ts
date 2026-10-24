import { NextRequest, NextResponse } from "next/server";
import { getRecommendationTrends, FinnhubError } from "@/lib/finnhub";
import { getAnalystPriceTargets } from "@/lib/yahoo";
import { SYMBOL } from "@/lib/timeframes";

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol") ?? SYMBOL;
  try {
    const [trends, targets] = await Promise.all([
      getRecommendationTrends(symbol),
      getAnalystPriceTargets(symbol),
    ]);
    if (!trends || trends.length === 0) {
      return NextResponse.json({ error: "NO_DATA" }, { status: 200 });
    }
    return NextResponse.json({
      trends: trends.sort((a, b) => a.period.localeCompare(b.period)),
      targets,
    });
  } catch (err) {
    if (err instanceof FinnhubError) {
      return NextResponse.json({ error: err.message }, { status: 200 });
    }
    return NextResponse.json({ error: "UNKNOWN_ERROR" }, { status: 500 });
  }
}
