import type { MarketHeatmapTile } from "./types";

export type MarketGroupBy = "sector" | "industry";

export interface WeightedMarketTile extends MarketHeatmapTile {
  /** Market cap in dollars. A missing cap falls back to the board's median only for
   *  sizing, never for the market-cap-weighted average. */
  weight: number;
}

export interface MarketSectorGroup {
  id: string;
  label: string;
  shortLabel: string;
  tiles: WeightedMarketTile[];
  weight: number;
  changePercent: number | null;
  advancers: number;
  decliners: number;
}

export interface MarketHeatmapModel {
  sectors: MarketSectorGroup[];
  tiles: WeightedMarketTile[];
  advancers: number;
  decliners: number;
  flat: number;
  unknown: number;
  /** Market-cap-weighted average of the visible companies; the overall market proxy. */
  weightedChange: number | null;
  totalMarketCap: number | null;
  leader: WeightedMarketTile | null;
  laggard: WeightedMarketTile | null;
  /** The full map uses a fixed ±3% scale so its legend always means the same thing. */
  scaleMax: number;
}

function weightedAverage(tiles: WeightedMarketTile[]): number | null {
  let weighted = 0;
  let weight = 0;
  for (const tile of tiles) {
    if (tile.changePercent === null) continue;
    weighted += tile.changePercent * tile.weight;
    weight += tile.weight;
  }
  return weight > 0 ? weighted / weight : null;
}

function slugify(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "group"
  );
}

/**
 * The full S&P 500 map groups companies by TradingView sector (or industry), sizes each
 * group and tile by market cap, and derives every displayed percentage from the same
 * visible tiles. That is the important difference from the old sector-ETF overview: the
 * group header, the overall market number and the tile colours can no longer disagree
 * because they all come from one snapshot.
 */
export function buildMarketHeatmapModel(
  tiles: MarketHeatmapTile[],
  groupBy: MarketGroupBy = "sector"
): MarketHeatmapModel {
  const caps = tiles
    .map((tile) => tile.marketCap)
    .filter((cap): cap is number => typeof cap === "number" && cap > 0)
    .sort((a, b) => a - b);
  const medianCap = caps.length > 0 ? caps[Math.floor((caps.length - 1) / 2)] : 1;

  const weightedTiles: WeightedMarketTile[] = tiles.map((tile) => ({
    ...tile,
    weight:
      typeof tile.marketCap === "number" && tile.marketCap > 0
        ? tile.marketCap
        : medianCap,
  }));

  const groups = new Map<string, WeightedMarketTile[]>();
  for (const tile of weightedTiles) {
    const rawKey = (groupBy === "industry" ? tile.industry : tile.sector).trim();
    const key = rawKey || "Other";
    const group = groups.get(key);
    if (group) group.push(tile);
    else groups.set(key, [tile]);
  }

  const sectors: MarketSectorGroup[] = Array.from(groups.entries()).map(
    ([label, groupTiles]) => {
      groupTiles.sort((a, b) => b.weight - a.weight || a.symbol.localeCompare(b.symbol));
      return {
        id: slugify(label),
        label,
        shortLabel: label,
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
  sectors.sort((a, b) => b.weight - a.weight || a.label.localeCompare(b.label, "en"));

  let advancers = 0;
  let decliners = 0;
  let flat = 0;
  let unknown = 0;
  let leader: WeightedMarketTile | null = null;
  let laggard: WeightedMarketTile | null = null;

  for (const tile of weightedTiles) {
    if (tile.changePercent === null) {
      unknown += 1;
      continue;
    }
    if (tile.changePercent > 0.005) advancers += 1;
    else if (tile.changePercent < -0.005) decliners += 1;
    else flat += 1;

    if (!leader || tile.changePercent > (leader.changePercent ?? 0)) leader = tile;
    if (!laggard || tile.changePercent < (laggard.changePercent ?? 0)) {
      laggard = tile;
    }
  }

  const totalMarketCap =
    caps.length > 0 ? caps.reduce((sum, cap) => sum + cap, 0) : null;

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
    scaleMax: 3,
  };
}
