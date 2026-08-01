import type { FinnhubCandles } from "./finnhub";

interface YahooChartResponse {
  chart: {
    result: Array<{
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

type CacheEntry = { expires: number; data: FinnhubCandles };
const cache = new Map<string, CacheEntry>();

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
