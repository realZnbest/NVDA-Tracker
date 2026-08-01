import type { FinnhubCandles } from "./finnhub";

interface YahooMeta {
  regularMarketPrice: number;
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

export type MarketSession = "pre" | "regular" | "post" | "closed";

export interface ExtendedHoursQuote {
  session: MarketSession;
  pre: { price: number; change: number; changePercent: number } | null;
  post: { price: number; change: number; changePercent: number } | null;
}

type CacheEntry = { expires: number; data: FinnhubCandles };
const cache = new Map<string, CacheEntry>();

type ExtCacheEntry = { expires: number; data: ExtendedHoursQuote };
const extendedCache = new Map<string, ExtCacheEntry>();

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

export async function getExtendedHoursQuote(symbol: string): Promise<ExtendedHoursQuote> {
  const hit = extendedCache.get(symbol);
  if (hit && hit.expires > Date.now()) return hit.data;

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=1m&includePrePost=true`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`YAHOO_HTTP_${res.status}`);
  const data = (await res.json()) as YahooChartResponse;
  const chartResult = data.chart.result?.[0];
  const meta = chartResult?.meta;
  if (!meta || !chartResult) throw new Error("YAHOO_NO_DATA");

  const period = meta.currentTradingPeriod;
  const timestamps = chartResult.timestamp;
  const closes = chartResult.indicators.quote[0].close;
  const previousClose = meta.chartPreviousClose ?? meta.previousClose ?? null;
  const regularPrice = meta.regularMarketPrice;
  const session = computeSession(period);
  const now = Date.now() / 1000;

  let pre: ExtendedHoursQuote["pre"] = null;
  let post: ExtendedHoursQuote["post"] = null;

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

  const result: ExtendedHoursQuote = { session, pre, post };

  extendedCache.set(symbol, { expires: Date.now() + 15_000, data: result });
  return result;
}

export interface AnalystTargets {
  targetHigh: number | null;
  targetLow: number | null;
  targetMean: number | null;
  targetMedian: number | null;
  recommendationKey: string | null;
  numberOfAnalysts: number | null;
}

interface CrumbSession {
  crumb: string;
  cookie: string;
  expires: number;
}

let crumbSession: CrumbSession | null = null;

// A realistic desktop-browser header set — Yahoo's anti-bot check on this specific
// endpoint is stricter than the chart endpoint above, and datacenter IPs (Render, etc.)
// get flagged far more than a residential connection, so looking as browser-like as
// possible matters here in a way it doesn't elsewhere in this file.
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
};

/**
 * quoteSummary requires a "crumb" token tied to a cookie session — Yahoo's anti-scraping
 * measure on this particular endpoint (the chart endpoint used elsewhere in this file
 * needs no such thing). Fetched once and reused; refreshed automatically if a request
 * using it fails, since the crumb can expire or get invalidated server-side.
 */
async function getCrumbSession(): Promise<CrumbSession> {
  if (crumbSession && crumbSession.expires > Date.now()) return crumbSession;

  // Let the redirect chain follow normally rather than intercepting it manually — Set-Cookie
  // visibility on a manually-intercepted redirect response is inconsistent across Node/undici
  // versions (worked in local dev, silently returned no cookie in at least one deployed
  // environment); a normal followed request reliably surfaces the cookie on the final response.
  const cookieRes = await fetch("https://fc.yahoo.com", {
    headers: BROWSER_HEADERS,
  });
  const cookie = cookieRes.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  if (!cookie) throw new Error("YAHOO_NO_COOKIE");

  const crumbRes = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
    headers: { ...BROWSER_HEADERS, Cookie: cookie },
  });
  if (!crumbRes.ok) throw new Error(`YAHOO_CRUMB_HTTP_${crumbRes.status}`);
  const crumb = await crumbRes.text();
  if (!crumb || crumb.includes("<")) throw new Error("YAHOO_CRUMB_INVALID");

  crumbSession = { crumb, cookie, expires: Date.now() + 55 * 60_000 };
  return crumbSession;
}

async function fetchAnalystTargetsLive(symbol: string): Promise<AnalystTargets> {
  const session = await getCrumbSession();
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=financialData&crumb=${encodeURIComponent(session.crumb)}`;

  let res = await fetch(url, {
    headers: { ...BROWSER_HEADERS, Cookie: session.cookie },
    cache: "no-store",
  });

  if (res.status === 401) {
    // Crumb likely expired/invalidated — refresh once and retry.
    crumbSession = null;
    const fresh = await getCrumbSession();
    res = await fetch(
      `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=financialData&crumb=${encodeURIComponent(fresh.crumb)}`,
      { headers: { ...BROWSER_HEADERS, Cookie: fresh.cookie }, cache: "no-store" }
    );
  }

  if (!res.ok) throw new Error(`YAHOO_HTTP_${res.status}`);
  const data = await res.json();
  const fd = data.quoteSummary?.result?.[0]?.financialData;
  if (!fd) throw new Error("YAHOO_NO_DATA");

  return {
    targetHigh: fd.targetHighPrice?.raw ?? null,
    targetLow: fd.targetLowPrice?.raw ?? null,
    targetMean: fd.targetMeanPrice?.raw ?? null,
    targetMedian: fd.targetMedianPrice?.raw ?? null,
    recommendationKey: fd.recommendationKey ?? null,
    numberOfAnalysts: fd.numberOfAnalystOpinions?.raw ?? null,
  };
}

let targetsFreshCache: { data: AnalystTargets; expires: number } | null = null;
// Kept indefinitely (no expiry) so a transient block on this flaky endpoint degrades to
// "slightly stale" instead of "gone" — price targets don't move minute to minute anyway.
let targetsLastKnownGood: AnalystTargets | null = null;

export async function getAnalystTargets(symbol: string): Promise<AnalystTargets> {
  if (targetsFreshCache && targetsFreshCache.expires > Date.now()) return targetsFreshCache.data;

  try {
    const fresh = await fetchAnalystTargetsLive(symbol);
    targetsFreshCache = { data: fresh, expires: Date.now() + 6 * 60 * 60_000 };
    targetsLastKnownGood = fresh;
    return fresh;
  } catch (err) {
    if (targetsLastKnownGood) return targetsLastKnownGood;
    throw err;
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

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${range}&interval=${interval}`;
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

  const quote = result.indicators.quote[0];
  const t: number[] = [];
  const o: number[] = [];
  const h: number[] = [];
  const l: number[] = [];
  const c: number[] = [];
  const v: number[] = [];

  for (let i = 0; i < result.timestamp.length; i++) {
    const open = quote.open[i];
    const high = quote.high[i];
    const low = quote.low[i];
    const close = quote.close[i];
    const volume = quote.volume[i];
    if (open === null || high === null || low === null || close === null) continue;
    t.push(result.timestamp[i]);
    o.push(open);
    h.push(high);
    l.push(low);
    c.push(close);
    v.push(volume ?? 0);
  }

  const candles: FinnhubCandles = { s: t.length > 0 ? "ok" : "no_data", t, o, h, l, c, v };
  cache.set(cacheKey, { expires: Date.now() + 60_000, data: candles });
  return candles;
}
