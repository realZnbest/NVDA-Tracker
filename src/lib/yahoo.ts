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
  const meta = data.chart.result?.[0]?.meta;
  if (!meta) throw new Error("YAHOO_NO_DATA");

  const result: ExtendedHoursQuote = {
    session: computeSession(meta.currentTradingPeriod),
    pre:
      meta.preMarketPrice !== undefined
        ? {
            price: meta.preMarketPrice,
            change: meta.preMarketChange ?? 0,
            changePercent: meta.preMarketChangePercent ?? 0,
          }
        : null,
    post:
      meta.postMarketPrice !== undefined
        ? {
            price: meta.postMarketPrice,
            change: meta.postMarketChange ?? 0,
            changePercent: meta.postMarketChangePercent ?? 0,
          }
        : null,
  };

  extendedCache.set(symbol, { expires: Date.now() + 15_000, data: result });
  return result;
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
