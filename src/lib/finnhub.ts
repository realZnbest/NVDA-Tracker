const BASE_URL = "https://finnhub.io/api/v1";

type CacheEntry = { expires: number; data: unknown };
const cache = new Map<string, CacheEntry>();

export class FinnhubError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function fetchFinnhub<T>(
  path: string,
  params: Record<string, string | number>,
  ttlMs: number
): Promise<T> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    throw new FinnhubError("MISSING_API_KEY", 0);
  }

  const search = new URLSearchParams({
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    token: apiKey,
  });
  const url = `${BASE_URL}${path}?${search.toString()}`;
  const cacheKey = url;

  const hit = cache.get(cacheKey);
  if (hit && hit.expires > Date.now()) {
    return hit.data as T;
  }

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new FinnhubError(`FINNHUB_HTTP_${res.status}`, res.status);
  }
  const data = (await res.json()) as T;
  cache.set(cacheKey, { expires: Date.now() + ttlMs, data });
  return data;
}

export interface FinnhubQuote {
  c: number;
  d: number;
  dp: number;
  h: number;
  l: number;
  o: number;
  pc: number;
  t: number;
}

export interface FinnhubCandles {
  c: number[];
  h: number[];
  l: number[];
  o: number[];
  s: string;
  t: number[];
  v: number[];
}

export interface FinnhubNewsItem {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

export interface FinnhubBasicFinancials {
  metric: Record<string, number | undefined>;
  series?: unknown;
}

export interface FinnhubReportedFinancials {
  data: Array<{
    year: number;
    quarter: number;
    form: string;
    startDate: string;
    endDate: string;
    report: {
      bs: Array<{ concept: string; label: string; value: number; unit?: string }>;
      ic: Array<{ concept: string; label: string; value: number; unit?: string }>;
      cf: Array<{ concept: string; label: string; value: number; unit?: string }>;
    };
  }>;
}

export function getQuote(symbol: string) {
  return fetchFinnhub<FinnhubQuote>("/quote", { symbol }, 15_000);
}

export function getCandles(
  symbol: string,
  resolution: string,
  from: number,
  to: number
) {
  return fetchFinnhub<FinnhubCandles>(
    "/stock/candle",
    { symbol, resolution, from, to },
    60_000
  );
}

export function getCompanyNews(symbol: string, from: string, to: string) {
  return fetchFinnhub<FinnhubNewsItem[]>(
    "/company-news",
    { symbol, from, to },
    5 * 60_000
  );
}

export function getBasicFinancials(symbol: string) {
  return fetchFinnhub<FinnhubBasicFinancials>(
    "/stock/metric",
    { symbol, metric: "all" },
    60 * 60_000
  );
}

export function getReportedFinancials(symbol: string, freq: "annual" | "quarterly") {
  return fetchFinnhub<FinnhubReportedFinancials>(
    "/stock/financials-reported",
    { symbol, freq },
    60 * 60_000
  );
}
