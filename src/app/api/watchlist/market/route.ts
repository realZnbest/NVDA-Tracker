import { NextRequest, NextResponse } from "next/server";
import { requireAlertsAuth } from "@/lib/alerts-auth";
import { getWatchlistMarket } from "@/lib/yahoo";
import { listWatchlist } from "@/lib/watchlist-store";
import { MAX_WATCHLIST_ITEMS, type WatchlistMarket } from "@/lib/types";

export const maxDuration = 60;

/**
 * Slow-moving companion to /api/watchlist/quotes: the intraday sparkline and the
 * after-hours print for each followed symbol. Batched so the client makes one request
 * instead of one per row, and cached server-side for 5 minutes in lib/yahoo.ts.
 */
export async function GET(request: NextRequest) {
  const unauth = await requireAlertsAuth();
  if (unauth) return unauth;

  let symbols: string[];
  try {
    const items = await listWatchlist();
    const requested = Number(request.nextUrl.searchParams.get("limit") ?? "");
    const limit =
      Number.isFinite(requested) && requested > 0
        ? Math.min(Math.floor(requested), MAX_WATCHLIST_ITEMS)
        : MAX_WATCHLIST_ITEMS;
    symbols = items.slice(0, limit).map((item) => item.symbol);
  } catch {
    return NextResponse.json({ error: "DB_UNAVAILABLE" }, { status: 503 });
  }

  const market: Record<string, WatchlistMarket> = {};
  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        market[symbol] = await getWatchlistMarket(symbol);
      } catch {
        // Best-effort: a failed row just omits its sparkline / after-hours line.
      }
    })
  );

  return NextResponse.json({ market, asOf: Date.now() });
}
