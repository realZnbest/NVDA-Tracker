import { NextRequest, NextResponse } from "next/server";
import { requireAlertsAuth } from "@/lib/alerts-auth";
import { getQuote, FinnhubError } from "@/lib/finnhub";
import { listWatchlist } from "@/lib/watchlist-store";
import { MAX_WATCHLIST_ITEMS, type WatchlistQuote } from "@/lib/types";

export const maxDuration = 60;

/**
 * One request for the whole watchlist instead of N `/api/quote` calls: that route also
 * opens a trade websocket and fetches extended-hours data per symbol, which is the right
 * trade-off for the one symbol being viewed but wasteful for a list of 10–30 rows.
 *
 * `?limit=` lets the landing-page preview fetch quotes only for the rows it renders,
 * while the full watchlist page asks for everything.
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
  if (symbols.length === 0) {
    return NextResponse.json({ quotes: {}, errors: {}, asOf: Date.now() });
  }

  const quotes: Record<string, WatchlistQuote> = {};
  const errors: Record<string, string> = {};

  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const quote = await getQuote(symbol);
        quotes[symbol] = {
          symbol,
          price: quote.c,
          change: quote.d,
          changePercent: quote.dp,
          open: quote.o,
          high: quote.h,
          low: quote.l,
          previousClose: quote.pc,
          time: quote.t,
        };
      } catch (err) {
        errors[symbol] = err instanceof FinnhubError ? err.message : "UNKNOWN_ERROR";
      }
    })
  );

  return NextResponse.json({ quotes, errors, asOf: Date.now() });
}
