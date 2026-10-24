import type { WeightedSector } from "./sector-heatmap-model";
import { squarify, type TreemapRect } from "./treemap";

export interface SectorBox {
  sector: WeightedSector;
  rect: TreemapRect;
}

/**
 * A single-level squarified treemap: eleven sector blocks, each sized by its approximate
 * Russell 1000 ICB weight. There is no inner stock layer here — the sector map is the overview,
 * and the stock detail is a separate drill-down. Keeping the geometry single-level is
 * what lets the smallest sectors keep a readable label at laptop widths.
 */
export function layoutSectorHeatmap(
  sectors: WeightedSector[],
  width: number,
  height: number
): SectorBox[] {
  if (sectors.length === 0 || width <= 0 || height <= 0) return [];

  const nodes = squarify(
    sectors.map((sector) => ({ item: sector, weight: sector.weight })),
    { x: 0, y: 0, width, height }
  );

  return nodes.map((node) => ({
    sector: node.item,
    rect: {
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
    },
  }));
}
