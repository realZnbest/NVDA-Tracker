import { NextResponse } from "next/server";
import { getRecommendationTrends, FinnhubError } from "@/lib/finnhub";
import { SYMBOL } from "@/lib/timeframes";

export async function GET() {
  try {
    const trends = await getRecommendationTrends(SYMBOL);
    if (!trends || trends.length === 0) {
      return NextResponse.json({ error: "NO_DATA" }, { status: 200 });
    }
    return NextResponse.json({
      trends: trends.sort((a, b) => a.period.localeCompare(b.period)),
    });
  } catch (err) {
    if (err instanceof FinnhubError) {
      return NextResponse.json({ error: err.message }, { status: 200 });
    }
    return NextResponse.json({ error: "UNKNOWN_ERROR" }, { status: 500 });
  }
}
