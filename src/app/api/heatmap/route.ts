import { NextResponse } from "next/server";
import { getHeatmapData } from "@/lib/heatmap";

export const maxDuration = 60;

/**
 * Public by design: the fixed large-cap universe contains no owner data. Prices come
 * from Yahoo's chart endpoint and market caps from Finnhub's profile endpoint; the
 * response is cached in-process for 45s while the market is open (5 min when shut).
 */
export async function GET() {
  try {
    const data = await getHeatmapData();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "HEATMAP_UNAVAILABLE" }, { status: 503 });
  }
}
