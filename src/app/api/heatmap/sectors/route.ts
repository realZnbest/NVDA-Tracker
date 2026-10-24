import { NextResponse } from "next/server";
import { getSectorHeatmapData } from "@/lib/heatmap-sectors";

export const maxDuration = 60;

/**
 * Public by design: the sector overview contains only market data. Each sector is
 * represented by its iShares U.S. sector ETF tracking a Russell 1000 ICB industry, so
 * the feed needs 11 Yahoo snapshots instead of the stock detail's 36 and never touches
 * Finnhub. The response is cached in-process for 45s while the market is open (5 min
 * when shut).
 */
export async function GET() {
  try {
    const data = await getSectorHeatmapData();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "HEATMAP_UNAVAILABLE" }, { status: 503 });
  }
}
