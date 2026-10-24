import { sectorLabel, sectorShortLabel } from "./heatmap-universe";
import type { HeatmapTile } from "./types";

export interface WeightedHeatmapTile extends HeatmapTile {
  /** Market cap in dollars, or the median cap when this tile's profile is missing.
   *  Sizing never invents a valuation; the fallback only keeps a tile visible. */
  weight: number;
}

export interface HeatmapSectorGroup {
  id: string;
  label: string;
  shortLabel: string;
  tiles: WeightedHeatmapTile[];
  weight: number;
  changePercent: number | null;
  advancers: number;
  decliners: number;
}

export interface HeatmapModel {
  sectors: HeatmapSectorGroup[];
  tiles: WeightedHeatmapTile[];
  advancers: number;
  decliners: number;
  flat: number;
  unknown: number;
  weightedChange: number | null;
  totalMarketCap: number | null;
  leader: WeightedHeatmapTile | null;
  laggard: WeightedHeatmapTile | null;
  /** Symmetric percentage bound used by the colour scale and its legend. */
  scaleMax: number;
}

function weightedAverage(
  tiles: WeightedHeatmapTile[]
): number | null {
  let weighted = 0;
  let weight = 0;
  for (const tile of tiles) {
    if (tile.changePercent === null) continue;
    weighted += tile.changePercent * tile.weight;
    weight += tile.weight;
  }
  return weight > 0 ? weighted / weight : null;
}

export function buildHeatmapModel(tiles: HeatmapTile[]): HeatmapModel {
  const caps = tiles
    .map((tile) => tile.marketCap)
    .filter((cap): cap is number => typeof cap === "number" && cap > 0)
    .sort((a, b) => a - b);
  const medianCap = caps.length > 0 ? caps[Math.floor((caps.length - 1) / 2)] : 1;

  const weightedTiles: WeightedHeatmapTile[] = tiles.map((tile) => ({
    ...tile,
    weight:
      typeof tile.marketCap === "number" && tile.marketCap > 0
        ? tile.marketCap
        : medianCap,
  }));

  const groups = new Map<string, WeightedHeatmapTile[]>();
  for (const tile of weightedTiles) {
    const group = groups.get(tile.sector);
    if (group) group.push(tile);
    else groups.set(tile.sector, [tile]);
  }

  const sectors: HeatmapSectorGroup[] = Array.from(groups.entries()).map(
    ([id, groupTiles]) => {
      groupTiles.sort((a, b) => b.weight - a.weight || a.symbol.localeCompare(b.symbol));
      return {
        id,
        label: sectorLabel(id),
        shortLabel: sectorShortLabel(id),
        tiles: groupTiles,
        weight: groupTiles.reduce((sum, tile) => sum + tile.weight, 0),
        changePercent: weightedAverage(groupTiles),
        advancers: groupTiles.filter(
          (tile) => tile.changePercent !== null && tile.changePercent > 0.005
        ).length,
        decliners: groupTiles.filter(
          (tile) => tile.changePercent !== null && tile.changePercent < -0.005
        ).length,
      };
    }
  );
  sectors.sort((a, b) => b.weight - a.weight);

  let advancers = 0;
  let decliners = 0;
  let flat = 0;
  let unknown = 0;
  let maxAbs = 0;
  let leader: WeightedHeatmapTile | null = null;
  let laggard: WeightedHeatmapTile | null = null;

  for (const tile of weightedTiles) {
    if (tile.changePercent === null) {
      unknown += 1;
      continue;
    }
    if (tile.changePercent > 0.005) advancers += 1;
    else if (tile.changePercent < -0.005) decliners += 1;
    else flat += 1;

    maxAbs = Math.max(maxAbs, Math.abs(tile.changePercent));
    if (!leader || tile.changePercent > (leader.changePercent ?? 0)) leader = tile;
    if (!laggard || tile.changePercent < (laggard.changePercent ?? 0)) laggard = tile;
  }

  const totalMarketCap = caps.length > 0 ? caps.reduce((sum, cap) => sum + cap, 0) : null;
  // A calm day would render the whole map nearly black at a fixed ±4% scale, and a
  // violent one would clip everything. A 2–6% bound keeps both ends readable while the
  // legend always states the exact range being shown.
  const scaleMax = Math.min(6, Math.max(2, Math.ceil(maxAbs * 2) / 2));

  return {
    sectors,
    tiles: weightedTiles,
    advancers,
    decliners,
    flat,
    unknown,
    weightedChange: weightedAverage(weightedTiles),
    totalMarketCap,
    leader,
    laggard,
    scaleMax,
  };
}
