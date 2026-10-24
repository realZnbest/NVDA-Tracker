import { mapWithConcurrency } from "./concurrency";
import { HEATMAP_SECTORS } from "./heatmap-universe";
import { pickMarketSession } from "./market-session";
import { getYahooMarketSnapshot } from "./yahoo";
import type { SectorHeatmapResponse, SectorTile } from "./types";

/** The client polls at the same cadence, so this cache only absorbs duplicate visitors
 *  and double-mounts inside one refresh window. */
const LIVE_CACHE_MS = 45_000;
const CLOSED_CACHE_MS = 5 * 60_000;
const YAHOO_CONCURRENCY = 6;

export class SectorHeatmapUnavailableError extends Error {}

let cache: { expires: number; data: SectorHeatmapResponse } | null = null;
let inFlight: Promise<SectorHeatmapResponse> | null = null;

async function buildSectorHeatmap(): Promise<SectorHeatmapResponse> {
  const snapshots = await mapWithConcurrency(
    HEATMAP_SECTORS,
    YAHOO_CONCURRENCY,
    async (sector) => {
      try {
        return await getYahooMarketSnapshot(sector.etf);
      } catch {
        return null;
      }
    }
  );

  const sectors: SectorTile[] = HEATMAP_SECTORS.map((sector, index) => {
    const snapshot = snapshots[index];
    return {
      id: sector.id,
      label: sector.label,
      shortLabel: sector.shortLabel,
      etf: sector.etf,
      marketWeight: sector.marketWeight,
      price: snapshot?.price ?? null,
      change: snapshot?.change ?? null,
      changePercent: snapshot?.changePercent ?? null,
      time: snapshot?.time ?? null,
    };
  });

  const failedSymbols = sectors
    .filter((sector) => sector.price === null)
    .map((sector) => sector.etf);
  if (failedSymbols.length === sectors.length) {
    throw new SectorHeatmapUnavailableError("NO_QUOTES");
  }

  const sessions = snapshots.flatMap((snapshot) =>
    snapshot ? [snapshot.session] : []
  );

  return {
    sectors,
    asOf: Date.now(),
    session: pickMarketSession(sessions),
    failedSymbols,
  };
}

/**
 * The sector overview is the public market map's primary feed. Each sector's day change
 * comes from its iShares U.S. sector ETF, which tracks a Russell 1000 ICB capped index
 * and is already cap-weighted inside the industry, avoiding the bias of a hand-picked
 * stock sample. The sector's area is a static approximate Russell 1000 ICB weight from
 * `heatmap-universe.ts`; it is deliberately not derived from the ETF price or AUM, which
 * would encode the fund's size rather than the market's.
 */
export async function getSectorHeatmapData(): Promise<SectorHeatmapResponse> {
  if (cache && cache.expires > Date.now()) return cache.data;
  if (inFlight) return inFlight;

  inFlight = buildSectorHeatmap()
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
