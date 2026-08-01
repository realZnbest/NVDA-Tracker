import { NextResponse } from "next/server";
import { getRecommendationTrends, FinnhubError } from "@/lib/finnhub";
import { getAnalystTargets } from "@/lib/yahoo";
import { SYMBOL } from "@/lib/timeframes";

export async function GET() {
  const [trendsResult, targetsResult] = await Promise.allSettled([
    getRecommendationTrends(SYMBOL),
    getAnalystTargets(SYMBOL),
  ]);

  const trends = trendsResult.status === "fulfilled" ? trendsResult.value : null;
  const targets = targetsResult.status === "fulfilled" ? targetsResult.value : null;

  if (!trends && !targets) {
    const err = trendsResult.status === "rejected" ? trendsResult.reason : targetsResult.status === "rejected" ? targetsResult.reason : null;
    if (err instanceof FinnhubError && err.message === "MISSING_API_KEY") {
      return NextResponse.json({ error: "MISSING_API_KEY" }, { status: 200 });
    }
    return NextResponse.json({ error: "NO_DATA" }, { status: 200 });
  }

  return NextResponse.json({
    trends: trends?.sort((a, b) => a.period.localeCompare(b.period)) ?? null,
    targets,
  });
}
