import { NextResponse } from "next/server";
import { getMarketHeatmapData } from "@/lib/market-heatmap";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

/**
 * Public by design: the full S&P 500 map contains only market data. TradingView's
 * scanner returns the index constituents, market caps, sectors, industries and logos in
 * one request, so this route does not fan out to 500 quote endpoints. The response is
 * cached in-process for 60s while the market is open (5 min when shut).
 */
export async function GET() {
  try {
    const data = await getMarketHeatmapData();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "HEATMAP_UNAVAILABLE" }, { status: 503 });
  }
}
