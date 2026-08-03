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

/**
 * Falls back across up to 3 keys (different Finnhub accounts) on rate-limit/auth
 * failure — same rotating-chain philosophy as the LLM provider chain in ai-provider.ts.
 * A working primary key never triggers any rotation, so this costs nothing in the
 * common case.
 */
function getFinnhubKeys(): string[] {
  return [
    process.env.FINNHUB_API_KEY,
    process.env.FINNHUB_API_KEY_BACKUP,
    process.env.FINNHUB_API_KEY_SECONDARY,
  ].filter((k): k is string => Boolean(k));
}

async function fetchFinnhub<T>(
  path: string,
  params: Record<string, string | number>,
  ttlMs: number
): Promise<T> {
  const keys = getFinnhubKeys();
  if (keys.length === 0) {
    throw new FinnhubError("MISSING_API_KEY", 0);
  }

  const search = new URLSearchParams(
    Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
  );
  // Cache key deliberately excludes the token — which key ends up serving a request
  // shouldn't fragment the cache, or a rotation would keep missing cache hits that a
  // different key already populated.
  const cacheKey = `${path}?${search.toString()}`;

  const hit = cache.get(cacheKey);
  if (hit && hit.expires > Date.now()) {
    return hit.data as T;
  }

  let lastError: FinnhubError = new FinnhubError("FINNHUB_HTTP_0", 0);
  for (const apiKey of keys) {
    const url = `${BASE_URL}${path}?${search.toString()}&token=${apiKey}`;
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as T;
      cache.set(cacheKey, { expires: Date.now() + ttlMs, data });
      return data;
    }
    lastError = new FinnhubError(`FINNHUB_HTTP_${res.status}`, res.status);
    // Only rotate on rate-limit/auth failures — anything else (400, 500, ...) isn't
    // key-related, so trying another key would just mask the real error.
    if (res.status !== 429 && res.status !== 401 && res.status !== 403) {
      throw lastError;
    }
  }
  throw lastError;
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

/**
 * TTL is deliberately kept just under the quote header's 3s poll — the REST snapshot
 * itself is now only a fallback/base for o/h/l/pc, since /api/quote overlays the live
 * trade websocket's latest print on top of it (see lib/finnhub-ws.ts), so this no longer
 * gates how fresh the displayed price can be.
 */
export function getQuote(symbol: string) {
  return fetchFinnhub<FinnhubQuote>("/quote", { symbol }, 2_500);
}

// Note: Finnhub's /stock/candle endpoint is restricted to paid plans.
// Historical price candles come from Yahoo Finance instead — see lib/yahoo.ts.

export interface FinnhubRecommendationTrend {
  symbol: string;
  period: string;
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
}

export function getRecommendationTrends(symbol: string) {
  return fetchFinnhub<FinnhubRecommendationTrend[]>(
    "/stock/recommendation",
    { symbol },
    6 * 60 * 60_000
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

export interface FinnhubEarningsEvent {
  symbol: string;
  date: string;
  hour: string;
  quarter: number;
  year: number;
  epsEstimate: number | null;
  epsActual: number | null;
  revenueEstimate: number | null;
  revenueActual: number | null;
}

export interface FinnhubEarningsCalendar {
  earningsCalendar: FinnhubEarningsEvent[];
}

export function getEarningsCalendar(symbol: string, from: string, to: string) {
  return fetchFinnhub<FinnhubEarningsCalendar>(
    "/calendar/earnings",
    { symbol, from, to },
    6 * 60 * 60_000
  );
}

export interface FinnhubSearchResult {
  symbol: string;
  displaySymbol: string;
  description: string;
  type: string;
}

export interface FinnhubSearchResponse {
  count: number;
  result: FinnhubSearchResult[];
}

export function searchSymbols(query: string) {
  return fetchFinnhub<FinnhubSearchResponse>("/search", { q: query }, 60 * 60_000);
}
