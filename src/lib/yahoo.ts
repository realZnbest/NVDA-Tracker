import type { FinnhubCandles } from "./finnhub";
import type { MarketSession, WatchlistMarket } from "./types";

export type { MarketSession } from "./types";

interface YahooMeta {
  regularMarketPrice: number;
  regularMarketChangePercent?: number;
  regularMarketTime?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
  shortName?: string;
  longName?: string;
  exchangeName?: string;
  fullExchangeName?: string;
  previousClose?: number;
  chartPreviousClose?: number;
  preMarketPrice?: number;
  preMarketChange?: number;
  preMarketChangePercent?: number;
  postMarketPrice?: number;
  postMarketChange?: number;
  postMarketChangePercent?: number;
  currentTradingPeriod?: {
    pre: { start: number; end: number };
    regular: { start: number; end: number };
    post: { start: number; end: number };
  };
}

interface YahooChartResponse {
  chart: {
    result: Array<{
      meta: YahooMeta;
      timestamp: number[];
      indicators: {
        quote: Array<{
          open: (number | null)[];
          high: (number | null)[];
          low: (number | null)[];
          close: (number | null)[];
          volume: (number | null)[];
        }>;
      };
    }> | null;
    error: { code: string; description: string } | null;
  };
}

export interface ExtendedHoursQuote {
  session: MarketSession;
  pre: { price: number; change: number; changePercent: number } | null;
  post: { price: number; change: number; changePercent: number } | null;
  /** Yahoo's exchange label (e.g. "NasdaqGS", "NYSE") — shown in the quote header
   *  instead of hardcoding every symbol as NASDAQ. */
  exchangeName: string | null;
  /** Company name from Yahoo metadata, so non-NVDA symbols don't fall back to a ticker. */
  companyName: string | null;
  /** Last official regular-session trade price — frozen outside regular hours (unlike
   *  the quote route's `c`, which keeps tracking pre/post trade prints all day). This is
   *  what the header shows as "the" price outside regular hours, with pre/post surfaced
   *  only in the dedicated extended-hours row. */
  regularMarketPrice: number;
}

type CacheEntry = { expires: number; data: FinnhubCandles };
const cache = new Map<string, CacheEntry>();

type ExtCacheEntry = { expires: number; data: ExtendedHoursQuote };
const extendedCache = new Map<string, ExtCacheEntry>();

type NameCacheEntry = { expires: number; data: string | null };
const nameCache = new Map<string, NameCacheEntry>();

function computeSession(period: YahooMeta["currentTradingPeriod"]): MarketSession {
  if (!period) return "closed";
  const now = Date.now() / 1000;
  if (now >= period.pre.start && now < period.pre.end) return "pre";
  if (now >= period.regular.start && now < period.regular.end) return "regular";
  if (now >= period.post.start && now < period.post.end) return "post";
  return "closed";
}

/** Last non-null close among bars whose timestamp falls within [start, end). */
function lastCloseInWindow(
  timestamps: number[],
  closes: (number | null)[],
  start: number,
  end: number
): number | null {
  for (let i = timestamps.length - 1; i >= 0; i--) {
    if (timestamps[i] >= start && timestamps[i] < end && closes[i] !== null) {
      return closes[i];
    }
  }
  return null;
}

type ExtendedPrice = { price: number; change: number; changePercent: number };

/** Shared pre/post derivation for the 1m header quote and the 5m watchlist snapshot, so
 *  the two views can never disagree about what "after hours" means. */
function deriveExtendedPrices(
  meta: YahooMeta,
  timestamps: number[],
  closes: (number | null)[],
  session: MarketSession
): { pre: ExtendedPrice | null; post: ExtendedPrice | null } {
  const period = meta.currentTradingPeriod;
  const previousClose = meta.chartPreviousClose ?? meta.previousClose ?? null;
  const regularPrice = meta.regularMarketPrice;
  const now = Date.now() / 1000;

  let pre: ExtendedPrice | null = null;
  let post: ExtendedPrice | null = null;

  // Only surface the ONE slot that is chronologically still relevant right now — never
  // a stale pre-market print left over from a trading day whose regular session (and
  // possibly post-market session too) has already happened since.
  if (session === "pre" && period) {
    if (meta.preMarketPrice !== undefined) {
      pre = {
        price: meta.preMarketPrice,
        change: meta.preMarketChange ?? 0,
        changePercent: meta.preMarketChangePercent ?? 0,
      };
    } else if (previousClose !== null) {
      const price = lastCloseInWindow(timestamps, closes, period.pre.start, period.pre.end);
      if (price !== null) {
        const change = price - previousClose;
        pre = { price, change, changePercent: (change / previousClose) * 100 };
      }
    }
  } else if (
    period &&
    (session === "post" || (session === "closed" && now >= period.post.end))
  ) {
    // Live after-hours, or the market is fully closed and the most recent session was
    // this day's post-market — keep showing that last print until the next pre-market opens.
    if (session === "post" && meta.postMarketPrice !== undefined) {
      post = {
        price: meta.postMarketPrice,
        change: meta.postMarketChange ?? 0,
        changePercent: meta.postMarketChangePercent ?? 0,
      };
    } else {
      const price = lastCloseInWindow(timestamps, closes, period.post.start, period.post.end);
      if (price !== null) {
        const change = price - regularPrice;
        post = { price, change, changePercent: (change / regularPrice) * 100 };
      }
    }
  }

  return { pre, post };
}

export async function getExtendedHoursQuote(symbol: string): Promise<ExtendedHoursQuote> {
  const hit = extendedCache.get(symbol);
  if (hit && hit.expires > Date.now()) return hit.data;

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1m&includePrePost=true`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`YAHOO_HTTP_${res.status}`);
  const data = (await res.json()) as YahooChartResponse;
  const chartResult = data.chart.result?.[0];
  const meta = chartResult?.meta;
  if (!meta || !chartResult) throw new Error("YAHOO_NO_DATA");

  const session = computeSession(meta.currentTradingPeriod);
  const timestamps = chartResult.timestamp;
  const closes = chartResult.indicators.quote[0].close;
  const { pre, post } = deriveExtendedPrices(meta, timestamps, closes, session);

  const result: ExtendedHoursQuote = {
    session,
    pre,
    post,
    exchangeName: meta.exchangeName ?? null,
    companyName: meta.longName ?? meta.shortName ?? null,
    regularMarketPrice: meta.regularMarketPrice,
  };

  // Matched to getQuote's TTL — both feed the same header row, and the extended-hours
  // delta is measured against the regular price, so letting one go stale while the other
  // refreshes would show a delta between two prices sampled seconds apart.
  extendedCache.set(symbol, { expires: Date.now() + 5_000, data: result });
  return result;
}

const watchlistCache = new Map<string, { expires: number; data: WatchlistMarket }>();

/** Downsamples a sparkline so a full watchlist stays a small JSON payload. */
function sampleSeries(values: number[], maxPoints: number): number[] {
  if (values.length <= maxPoints) return values;
  const step = (values.length - 1) / (maxPoints - 1);
  return Array.from({ length: maxPoints }, (_, i) => values[Math.round(i * step)]);
}

/**
 * One Yahoo request per symbol supplies both the intraday sparkline and the after-hours
 * print. Kept on a 5-minute cache because neither needs minute-level freshness, while
 * /api/watchlist/quotes keeps the live price on its 60s poll.
 */
export async function getWatchlistMarket(symbol: string): Promise<WatchlistMarket> {
  const hit = watchlistCache.get(symbol);
  if (hit && hit.expires > Date.now()) return hit.data;

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=5m&includePrePost=true`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`YAHOO_HTTP_${res.status}`);
  const data = (await res.json()) as YahooChartResponse;
  const chartResult = data.chart.result?.[0];
  const meta = chartResult?.meta;
  if (!meta || !chartResult) throw new Error("YAHOO_NO_DATA");

  const timestamps = chartResult.timestamp ?? [];
  const closes = chartResult.indicators.quote?.[0]?.close ?? [];
  const session = computeSession(meta.currentTradingPeriod);
  const { pre, post: derivedPost } = deriveExtendedPrices(meta, timestamps, closes, session);

  // Keep every non-null print and let the SVG smooth it out. The session periods in
  // meta can describe the NEXT session while range=1d still returns the previous one
  // (e.g. before the opening bell), so filtering by them would blank the line.
  const points = closes.filter((c): c is number => c !== null && Number.isFinite(c));

  // Before the pre-market opens, meta has no after-hours fields yet, but the chart still
  // ends on the PREVIOUS session's last post-market print. Surface that as the extended
  // price instead of leaving the row blank until the next session. A print equal to the
  // regular close means the symbol simply had no after-hours trade — nothing to show.
  let post = derivedPost;
  if (!post && session === "closed" && points.length > 0) {
    const last = points[points.length - 1];
    const regularPrice = meta.regularMarketPrice;
    if (regularPrice > 0) {
      const change = last - regularPrice;
      if (Math.abs(change) >= 0.005) {
        post = { price: last, change, changePercent: (change / regularPrice) * 100 };
      }
    }
  }

  const sparkline = sampleSeries(points, 60).map((c) => Math.round(c * 100) / 100);

  const result: WatchlistMarket = { session, pre, post, sparkline };
  watchlistCache.set(symbol, { expires: Date.now() + 5 * 60_000, data: result });
  return result;
}

export interface YahooMarketSnapshot {
  price: number;
  change: number | null;
  changePercent: number | null;
  previousClose: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  name: string | null;
  exchangeName: string | null;
  session: MarketSession;
  /** Unix seconds of the last regular-session print. */
  time: number | null;
}

const marketSnapshotCache = new Map<
  string,
  { expires: number; data: YahooMarketSnapshot }
>();

/**
 * A compact one-request snapshot for the market heatmap: price, day change and the
 * session state. The chart endpoint is the same unauthenticated Yahoo source the
 * candles use, which keeps the heatmap's 36-symbol refresh off the Finnhub quote
 * quota entirely (market caps still come from Finnhub's profile endpoint, cached a
 * day). The longer cache while shut matches the fact that the number cannot move.
 */
export async function getYahooMarketSnapshot(symbol: string): Promise<YahooMarketSnapshot> {
  const hit = marketSnapshotCache.get(symbol);
  if (hit && hit.expires > Date.now()) return hit.data;

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`YAHOO_HTTP_${res.status}`);
  const data = (await res.json()) as YahooChartResponse;
  const meta = data.chart.result?.[0]?.meta;
  if (!meta || !Number.isFinite(meta.regularMarketPrice) || meta.regularMarketPrice <= 0) {
    throw new Error("YAHOO_NO_DATA");
  }

  const previousClose = meta.chartPreviousClose ?? meta.previousClose ?? null;
  const changePercent =
    typeof meta.regularMarketChangePercent === "number" &&
    Number.isFinite(meta.regularMarketChangePercent)
      ? meta.regularMarketChangePercent
      : previousClose !== null && previousClose > 0
        ? ((meta.regularMarketPrice - previousClose) / previousClose) * 100
        : null;
  const session = computeSession(meta.currentTradingPeriod);

  const snapshot: YahooMarketSnapshot = {
    price: meta.regularMarketPrice,
    change: previousClose !== null ? meta.regularMarketPrice - previousClose : null,
    changePercent,
    previousClose,
    dayHigh: Number.isFinite(meta.regularMarketDayHigh)
      ? (meta.regularMarketDayHigh as number)
      : null,
    dayLow: Number.isFinite(meta.regularMarketDayLow)
      ? (meta.regularMarketDayLow as number)
      : null,
    volume: Number.isFinite(meta.regularMarketVolume)
      ? (meta.regularMarketVolume as number)
      : null,
    name: meta.longName ?? meta.shortName ?? null,
    exchangeName: meta.fullExchangeName ?? meta.exchangeName ?? null,
    session,
    time: Number.isFinite(meta.regularMarketTime)
      ? (meta.regularMarketTime as number)
      : null,
  };

  marketSnapshotCache.set(symbol, {
    expires: Date.now() + (session === "closed" ? 5 * 60_000 : 45_000),
    data: snapshot,
  });
  return snapshot;
}

/**
 * Intraday bars move minute to minute, so a flat one-minute cache made the chart's
 * live refresh mostly redundant; daily/weekly bars only change once a session, so
 * caching those harder costs nothing and keeps Yahoo request volume down.
 */
function candleCacheTtl(interval: string): number {
  return interval.endsWith("m") ? 30_000 : 5 * 60_000;
}

/**
 * Company name used to judge whether a news article is really about `symbol`.
 * Cached for a day: names change rarely, and news routes call this on every load.
 */
export async function getYahooCompanyName(symbol: string): Promise<string | null> {
  const hit = nameCache.get(symbol);
  if (hit && hit.expires > Date.now()) return hit.data;

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as YahooChartResponse;
    const meta = data.chart.result?.[0]?.meta;
    const name = meta?.longName ?? meta?.shortName ?? null;
    nameCache.set(symbol, { expires: Date.now() + 24 * 60 * 60_000, data: name });
    return name;
  } catch {
    // Best-effort: callers fall back to ticker-only matching / the raw feed.
    return null;
  }
}

export async function getYahooCandles(
  symbol: string,
  range: string,
  interval: string
): Promise<FinnhubCandles> {
  const cacheKey = `${symbol}:${range}:${interval}`;
  const hit = cache.get(cacheKey);
  if (hit && hit.expires > Date.now()) return hit.data;

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`YAHOO_HTTP_${res.status}`);
  }
  const data = (await res.json()) as YahooChartResponse;
  const result = data.chart.result?.[0];
  if (!result) {
    throw new Error("YAHOO_NO_DATA");
  }

  const quote = result.indicators.quote?.[0];
  const timestamps = result.timestamp;
  if (!quote || !Array.isArray(timestamps)) {
    throw new Error("YAHOO_NO_DATA");
  }

  const t: number[] = [];
  const o: number[] = [];
  const h: number[] = [];
  const l: number[] = [];
  const c: number[] = [];
  const v: number[] = [];

  for (let i = 0; i < timestamps.length; i++) {
    const open = quote.open[i];
    const high = quote.high[i];
    const low = quote.low[i];
    const close = quote.close[i];
    const volume = quote.volume[i];
    if (open == null || high == null || low == null || close == null) continue;
    t.push(timestamps[i]);
    o.push(open);
    h.push(high);
    l.push(low);
    c.push(close);
    v.push(volume ?? 0);
  }

  const candles: FinnhubCandles = { s: t.length > 0 ? "ok" : "no_data", t, o, h, l, c, v };
  cache.set(cacheKey, { expires: Date.now() + candleCacheTtl(interval), data: candles });
  return candles;
}
