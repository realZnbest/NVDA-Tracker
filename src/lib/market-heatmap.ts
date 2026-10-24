import { getYahooMarketSnapshot } from "./yahoo";
import type { MarketHeatmapResponse, MarketHeatmapTile, MarketSession } from "./types";

const TV_SCAN_URL = "https://scanner.tradingview.com/america/scan";
const TV_COLUMNS = [
  "name",
  "description",
  "close",
  "change",
  "change_abs",
  "market_cap_basic",
  "sector",
  "industry",
  "logo",
  "volume",
  "update_mode",
  "time",
] as const;

/** Dual-class companies appear twice in the S&P 500 constituent list. The map shows
 *  one tile per company, preferring the class that is normally quoted as the primary
 *  line. This prevents Alphabet, Fox and News Corp from being double-counted in the
 *  market-cap-weighted average. */
const PREFERRED_TICKERS = new Set(["GOOGL", "FOXA", "NWS"]);

const LIVE_CACHE_MS = 60_000;
const CLOSED_CACHE_MS = 5 * 60_000;

export class MarketHeatmapUnavailableError extends Error {}

interface RawMarketRow {
  ticker: string;
  exchange: string;
  name: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  marketCap: number | null;
  sector: string;
  industry: string;
  logoUrl: string | null;
  volume: number;
  updateMode: string | null;
  /** Unix seconds, matching the rest of the app's quote shapes. */
  time: number | null;
}

interface TvScanResponse {
  totalCount?: unknown;
  data?: unknown;
}

let cache: { expires: number; data: MarketHeatmapResponse } | null = null;
let inFlight: Promise<MarketHeatmapResponse> | null = null;

function toNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toLogoUrl(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const logoid = (value as { logoid?: unknown }).logoid;
  if (typeof logoid !== "string" || !/^[a-z0-9-]+$/i.test(logoid)) return null;
  return `https://s3-symbol-logo.tradingview.com/${logoid}--big.svg`;
}

function parseDelayMinutes(updateMode: string | null): number | null {
  if (!updateMode) return null;
  const match = /delayed_streaming_(\d+)/.exec(updateMode);
  if (!match) return null;
  return Math.max(1, Math.round(Number(match[1]) / 60));
}

function parseRows(payload: TvScanResponse): RawMarketRow[] {
  if (!Array.isArray(payload.data)) {
    throw new MarketHeatmapUnavailableError("TradingView returned no data");
  }

  const rows: RawMarketRow[] = [];
  for (const entry of payload.data) {
    if (!entry || typeof entry !== "object") continue;
    const { s, d } = entry as { s?: unknown; d?: unknown };
    if (typeof s !== "string" || !Array.isArray(d)) continue;

    const [
      rawTicker,
      rawDescription,
      rawClose,
      rawChange,
      rawChangeAbs,
      rawMarketCap,
      rawSector,
      rawIndustry,
      rawLogo,
      rawVolume,
      rawUpdateMode,
      rawTime,
    ] = d;

    const ticker = toStringValue(rawTicker) || s.split(":").slice(1).join(":");
    if (!ticker) continue;
    const exchange = s.split(":")[0] ?? "";
    const price = toNumber(rawClose);
    const changePercent = toNumber(rawChange);
    const marketCap = toNumber(rawMarketCap);
    const volume = toNumber(rawVolume) ?? 0;
    const time = toNumber(rawTime);

    let change = toNumber(rawChangeAbs);
    if (change === null && price !== null && changePercent !== null) {
      const previousClose = price / (1 + changePercent / 100);
      change = price - previousClose;
    }

    rows.push({
      ticker,
      exchange,
      name: toStringValue(rawDescription) || ticker,
      price,
      change,
      changePercent,
      marketCap,
      sector: toStringValue(rawSector) || "Other",
      industry: toStringValue(rawIndustry) || "Other",
      logoUrl: toLogoUrl(rawLogo),
      volume,
      updateMode: toStringValue(rawUpdateMode) || null,
      time,
    });
  }

  return rows;
}

function dedupeCompanies(rows: RawMarketRow[]): RawMarketRow[] {
  const byCompany = new Map<string, RawMarketRow>();

  for (const row of rows) {
    const key = row.name.toLocaleLowerCase("en-US") || row.ticker;
    const current = byCompany.get(key);
    if (!current) {
      byCompany.set(key, row);
      continue;
    }

    const currentPreferred = PREFERRED_TICKERS.has(current.ticker);
    const nextPreferred = PREFERRED_TICKERS.has(row.ticker);
    if (nextPreferred && !currentPreferred) {
      byCompany.set(key, row);
      continue;
    }
    if (!nextPreferred && !currentPreferred && row.volume > current.volume) {
      byCompany.set(key, row);
    }
  }

  return [...byCompany.values()];
}

async function fetchTvRows(): Promise<RawMarketRow[]> {
  const res = await fetch(TV_SCAN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0",
      Accept: "application/json",
    },
    body: JSON.stringify({
      filter: [{ left: "name", operation: "nempty" }],
      options: { lang: "en" },
      symbols: {
        query: { types: [] },
        tickers: [],
        groups: [{ type: "index", values: ["SP:SPX"] }],
      },
      columns: TV_COLUMNS,
      sort: { sortBy: "market_cap_basic", sortOrder: "desc" },
      range: [0, 600],
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });

  if (!res.ok) {
    throw new MarketHeatmapUnavailableError(`TradingView HTTP ${res.status}`);
  }

  const payload = (await res.json()) as TvScanResponse;
  return dedupeCompanies(parseRows(payload));
}

async function buildMarketHeatmap(): Promise<MarketHeatmapResponse> {
  const rows = await fetchTvRows();
  if (rows.length === 0) {
    throw new MarketHeatmapUnavailableError("TradingView returned an empty S&P 500 list");
  }

  let session: MarketSession = "closed";
  try {
    session = (await getYahooMarketSnapshot("SPY")).session;
  } catch {
    // The scanner still has usable last-session data. A missing session probe must not
    // take down the whole map; the badge simply reports closed until the next refresh.
  }

  const tiles: MarketHeatmapTile[] = rows
    .map((row) => ({
      symbol: row.ticker,
      name: row.name,
      sector: row.sector,
      industry: row.industry,
      price: row.price,
      change: row.change,
      changePercent: row.changePercent,
      marketCap: row.marketCap,
      currency: "USD",
      time: row.time,
      exchange: row.exchange,
      logoUrl: row.logoUrl,
      updateMode: row.updateMode,
    }))
    .sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0));

  const dataTimeSeconds = rows.reduce((max, row) => Math.max(max, row.time ?? 0), 0);
  const delayedMinutes =
    rows.map((row) => parseDelayMinutes(row.updateMode)).find((value) => value !== null) ??
    null;

  return {
    tiles,
    asOf: Date.now(),
    dataTime: dataTimeSeconds > 0 ? dataTimeSeconds * 1000 : null,
    session,
    source: "TradingView",
    delayedMinutes,
    failedSymbols: [],
  };
}

/** Fetch and cache the full S&P 500 map. The scanner is a single POST for all 500
 *  companies, so unlike the old 36-symbol board this does not need per-symbol fan-out.
 *  The response is cached in-process for 60s while the market is open (5 min when shut). */
export async function getMarketHeatmapData(): Promise<MarketHeatmapResponse> {
  const now = Date.now();
  if (cache && cache.expires > now) return cache.data;
  if (inFlight) return inFlight;

  inFlight = buildMarketHeatmap()
    .then((data) => {
      const ttl = data.session === "regular" ? LIVE_CACHE_MS : CLOSED_CACHE_MS;
      cache = { expires: Date.now() + ttl, data };
      return data;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}
