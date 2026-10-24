import { mapWithConcurrency } from "./concurrency";
import {
  getCompanyProfile,
  isFinnhubConfigured,
  type FinnhubCompanyProfile,
} from "./finnhub";
import { HEATMAP_UNIVERSE } from "./heatmap-universe";
import { pickMarketSession } from "./market-session";
import { getYahooMarketSnapshot, type YahooMarketSnapshot } from "./yahoo";
import type { HeatmapResponse, HeatmapTile } from "./types";

/** The client polls at the same cadence, so the server cache only has to absorb
 *  duplicate visitors and double-mounts inside one refresh window. */
const LIVE_CACHE_MS = 45_000;
const CLOSED_CACHE_MS = 5 * 60_000;
const YAHOO_CONCURRENCY = 8;
const FINNHUB_CONCURRENCY = 6;
/** If a configured Finnhub key is invalid or exhausted, don't spend 36 failed profile
 *  calls on every heatmap refresh — wait a while before trying the chain again. */
const PROFILE_RETRY_COOLDOWN_MS = 10 * 60_000;

export class HeatmapUnavailableError extends Error {}

let cache: { expires: number; data: HeatmapResponse } | null = null;
let inFlight: Promise<HeatmapResponse> | null = null;
let profilesDisabledUntil = 0;

async function buildHeatmap(): Promise<HeatmapResponse> {
  const shouldLoadProfiles =
    isFinnhubConfigured() && Date.now() >= profilesDisabledUntil;

  const snapshotPromise = mapWithConcurrency(
    HEATMAP_UNIVERSE,
    YAHOO_CONCURRENCY,
    async (entry): Promise<YahooMarketSnapshot | null> => {
      try {
        return await getYahooMarketSnapshot(entry.symbol);
      } catch {
        return null;
      }
    }
  );

  const profilePromise: Promise<Array<FinnhubCompanyProfile | null>> = shouldLoadProfiles
    ? mapWithConcurrency(
        HEATMAP_UNIVERSE,
        FINNHUB_CONCURRENCY,
        async (entry): Promise<FinnhubCompanyProfile | null> => {
          try {
            return await getCompanyProfile(entry.symbol);
          } catch {
            return null;
          }
        }
      )
    : Promise.resolve(HEATMAP_UNIVERSE.map(() => null));

  const [snapshots, profiles] = await Promise.all([snapshotPromise, profilePromise]);

  const tiles: HeatmapTile[] = HEATMAP_UNIVERSE.map((entry, index) => {
    const snapshot = snapshots[index];
    const profile = profiles[index];
    const rawCap = profile?.marketCapitalization;
    const marketCap =
      typeof rawCap === "number" && rawCap > 0 ? rawCap * 1_000_000 : null;

    return {
      symbol: entry.symbol,
      name: profile?.name?.trim() || snapshot?.name || entry.name,
      sector: entry.sector,
      price: snapshot?.price ?? null,
      change: snapshot?.change ?? null,
      changePercent: snapshot?.changePercent ?? null,
      marketCap,
      currency: profile?.currency || "USD",
      time: snapshot?.time ?? null,
    };
  });

  const failedSymbols = tiles
    .filter((tile) => tile.price === null)
    .map((tile) => tile.symbol);
  if (failedSymbols.length === tiles.length) {
    throw new HeatmapUnavailableError("NO_QUOTES");
  }

  const hasCaps = tiles.some((tile) => tile.marketCap !== null);
  if (shouldLoadProfiles && !hasCaps) {
    profilesDisabledUntil = Date.now() + PROFILE_RETRY_COOLDOWN_MS;
  } else if (hasCaps) {
    profilesDisabledUntil = 0;
  }

  const sessions = snapshots.flatMap((snapshot) =>
    snapshot ? [snapshot.session] : []
  );
  const session = pickMarketSession(sessions);

  return {
    tiles,
    asOf: Date.now(),
    session,
    failedSymbols,
    marketCapAvailable: hasCaps,
  };
}

export async function getHeatmapData(): Promise<HeatmapResponse> {
  if (cache && cache.expires > Date.now()) return cache.data;
  if (inFlight) return inFlight;

  inFlight = buildHeatmap()
    .then((data) => {
      cache = {
        data,
        expires:
          Date.now() + (data.session === "closed" ? CLOSED_CACHE_MS : LIVE_CACHE_MS),
      };
      return data;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}
