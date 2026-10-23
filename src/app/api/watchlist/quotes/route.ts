import { NextRequest, NextResponse } from "next/server";
import { requireAlertsAuth } from "@/lib/alerts-auth";
import { getQuote, peekQuote, FinnhubError } from "@/lib/finnhub";
import { getLiveTick, subscribeSymbol } from "@/lib/finnhub-ws";
import { listWatchlist } from "@/lib/watchlist-store";
import { MAX_WATCHLIST_ITEMS, type WatchlistQuote } from "@/lib/types";

export const maxDuration = 60;

/**
 * The trade websocket is the live source; REST only supplies the day's base fields
 * (previous close, open, high, low). While ticks are arriving, one REST snapshot every
 * five minutes is plenty and cuts provider usage ~5x versus the old once-a-minute poll
 * of every symbol. If ticks stop — after hours, or a dropped socket — fall back to the
 * 60s cadence so a row can never silently freeze on an old price.
 */
const REST_REFRESH_WITH_TICKS_MS = 5 * 60_000;
const REST_REFRESH_NO_TICKS_MS = 60_000;
const TICK_FRESH_MS = 90_000;

/** Per-symbol time of the last REST attempt, shared by every request in this process. */
const lastRestAt = new Map<string, number>();

/**
 * A serverless invocation starts this module moments before the handler runs; a
 * long-lived Node process (local dev, VPS, Docker) has been up for much longer. The
 * client only switches to its 5s cadence when this process has also actually received
 * a websocket tick — that combination can't happen on a cold serverless function, so
 * the fast UI can never turn into 12x the REST calls there.
 */
const processStartedAt = (() => {
  // Kept on globalThis so a dev hot reload doesn't reset the clock and demote the
  // client back to 60s for 10 seconds after every edit. A serverless cold start still
  // gets a fresh value, which is exactly the signal we want there.
  const g = globalThis as typeof globalThis & { __watchlistQuotesStartedAt?: number };
  g.__watchlistQuotesStartedAt ??= Date.now();
  return g.__watchlistQuotesStartedAt;
})();
const STREAM_WARMUP_MS = 10_000;

/**
 * One request for the whole watchlist instead of N `/api/quote` calls: that route also
 * opens a trade websocket and fetches extended-hours data per symbol, which is the right
 * trade-off for the one symbol being viewed but wasteful for a list of 10–30 rows.
 *
 * The response is cheap to poll: price/change come from the websocket tick when one is
 * available, and the REST base is re-read from the in-process cache on every other call.
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
    return NextResponse.json({ quotes: {}, errors: {}, asOf: Date.now(), live: false });
  }

  const quotes: Record<string, WatchlistQuote> = {};
  const errors: Record<string, string> = {};

  await Promise.all(
    symbols.map(async (symbol) => {
      // Idempotent; makes the shared websocket connection carry this row's trades.
      subscribeSymbol(symbol);

      const now = Date.now();
      // Decide the REST cadence from the tick we already have. Re-read it after the
      // fetch for the quote itself: a print often lands while REST is in flight, and
      // using it makes the very first response of a page load live too.
      const tickBefore = getLiveTick(symbol);
      const hasFreshTick = tickBefore !== null && now - tickBefore.time < TICK_FRESH_MS;
      let base = peekQuote(symbol);

      const lastRest = lastRestAt.get(symbol) ?? 0;
      const refreshAfter = hasFreshTick
        ? REST_REFRESH_WITH_TICKS_MS
        : REST_REFRESH_NO_TICKS_MS;
      if (!base || now - lastRest >= refreshAfter) {
        // Stamp the attempt before awaiting so concurrent polls don't stack up REST
        // calls for the same symbol; a failed attempt also waits out the interval.
        lastRestAt.set(symbol, now);
        try {
          base = await getQuote(symbol);
        } catch (err) {
          if (!base) {
            errors[symbol] = err instanceof FinnhubError ? err.message : "UNKNOWN_ERROR";
            return;
          }
          // Keep the last good snapshot rather than blanking a row on a transient
          // provider failure; the tick (if any) still keeps the price moving.
        }
      }

      if (!base) {
        errors[symbol] = "NO_DATA";
        return;
      }

      // A websocket print is only an overlay: `pc` still anchors the day's change, so
      // the percentage stays comparable with the dashboard's quote header.
      const tick = getLiveTick(symbol);
      const useTick = tick !== null && tick.time > base.t * 1000;
      const price = useTick ? tick.price : base.c;
      const change = useTick && base.pc ? price - base.pc : base.d;
      const changePercent =
        useTick && base.pc ? (change / base.pc) * 100 : base.dp;

      quotes[symbol] = {
        symbol,
        price,
        change,
        changePercent,
        open: base.o,
        high: base.h,
        low: base.l,
        previousClose: base.pc,
        time: useTick ? Math.floor(tick.time / 1000) : base.t,
      };
    })
  );

  // Fast-client gate: this process must be old enough to rule out a cold serverless
  // invocation, and at least one row must have a fresh trade print. Without both, the
  // client stays on its 60s cadence and every request is one REST batch, as before.
  const now = Date.now();
  const live =
    now - processStartedAt > STREAM_WARMUP_MS &&
    symbols.some((symbol) => {
      const tick = getLiveTick(symbol);
      return tick !== null && now - tick.time < TICK_FRESH_MS;
    });

  return NextResponse.json({ quotes, errors, asOf: now, live });
}
