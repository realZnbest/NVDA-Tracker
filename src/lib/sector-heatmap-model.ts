import type { SectorTile } from "./types";

export interface WeightedSector extends SectorTile {
  /** Percent share of the Russell 1000 (ICB) used for area and for the market average. */
  weight: number;
}

export interface SectorHeatmapModel {
  sectors: WeightedSector[];
  advancers: number;
  decliners: number;
  flat: number;
  unknown: number;
  /** Sector-weight-weighted average of the sector ETF changes; a market-wide proxy. */
  weightedChange: number | null;
  leader: WeightedSector | null;
  laggard: WeightedSector | null;
  /** Symmetric percentage bound used by the colour scale and its legend. */
  scaleMax: number;
}

function weightedAverage(sectors: WeightedSector[]): number | null {
  let weighted = 0;
  let weight = 0;
  for (const sector of sectors) {
    if (sector.changePercent === null) continue;
    weighted += sector.changePercent * sector.weight;
    weight += sector.weight;
  }
  return weight > 0 ? weighted / weight : null;
}

/**
 * The sector map is intentionally a different aggregation from the stock detail below:
 * sectors are sized by their approximate Russell 1000 ICB weight, not by the sum of a
 * stock sample, so a handful of hand-picked mega caps can no longer distort the market's
 * shape. The day's colour comes from each iShares sector ETF, which is cap-weighted
 * inside the industry by construction.
 */
export function buildSectorHeatmapModel(sectors: SectorTile[]): SectorHeatmapModel {
  const weighted: WeightedSector[] = sectors
    .map((sector) => ({ ...sector, weight: sector.marketWeight }))
    .sort((a, b) => b.weight - a.weight || a.label.localeCompare(b.label, "th"));

  let advancers = 0;
  let decliners = 0;
  let flat = 0;
  let unknown = 0;
  let maxAbs = 0;
  let leader: WeightedSector | null = null;
  let laggard: WeightedSector | null = null;

  for (const sector of weighted) {
    if (sector.changePercent === null) {
      unknown += 1;
      continue;
    }
    if (sector.changePercent > 0.005) advancers += 1;
    else if (sector.changePercent < -0.005) decliners += 1;
    else flat += 1;

    maxAbs = Math.max(maxAbs, Math.abs(sector.changePercent));
    if (!leader || sector.changePercent > (leader.changePercent ?? 0)) leader = sector;
    if (!laggard || sector.changePercent < (laggard.changePercent ?? 0)) laggard = sector;
  }

  // Sector moves are smaller than single-stock moves. A 1.5–3% bound keeps an ordinary
  // rotation readable without turning a broad +0.6% day into a uniformly dark wall; a
  // genuine outlier clips at the top rather than flattening every other sector.
  const scaleMax = Math.min(3, Math.max(1.5, Math.ceil(maxAbs * 2) / 2));

  return {
    sectors: weighted,
    advancers,
    decliners,
    flat,
    unknown,
    weightedChange: weightedAverage(weighted),
    leader,
    laggard,
    scaleMax,
  };
}
