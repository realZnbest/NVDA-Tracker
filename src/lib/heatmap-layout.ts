import type { HeatmapSectorGroup, WeightedHeatmapTile } from "./heatmap-model";
import { squarify, type TreemapRect } from "./treemap";

export interface HeatmapTileBox {
  tile: WeightedHeatmapTile;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HeatmapSectorBox {
  sector: HeatmapSectorGroup;
  /** Outer block, already inset from its neighbours. */
  rect: TreemapRect;
  headerHeight: number;
  tileWidth: number;
  tileHeight: number;
  tiles: HeatmapTileBox[];
}

/**
 * Sectors are drawn proportionally to total market cap, but with a small floor so the
 * smallest sectors still get a readable block instead of a two-pixel sliver. Inside a
 * sector the tiles use the raw market caps, so the largest company really does dominate
 * its group. The floor only affects the cross-sector split, never the intra-sector one.
 */
export function layoutHeatmap(
  sectors: HeatmapSectorGroup[],
  width: number,
  height: number,
  minSectorShare = 0.025
): HeatmapSectorBox[] {
  if (sectors.length === 0 || width <= 0 || height <= 0) return [];

  const totalWeight = sectors.reduce((sum, sector) => sum + sector.weight, 0);
  if (!(totalWeight > 0)) return [];
  const floor = totalWeight * minSectorShare;

  const sectorNodes = squarify(
    sectors.map((sector) => ({
      item: sector,
      weight: Math.max(sector.weight, floor),
    })),
    { x: 0, y: 0, width, height }
  );

  const boxes: HeatmapSectorBox[] = [];

  for (const node of sectorNodes) {
    const rect = {
      x: node.x + 1,
      y: node.y + 1,
      width: Math.max(0, node.width - 2),
      height: Math.max(0, node.height - 2),
    };
    if (rect.width <= 0 || rect.height <= 0) continue;

    const headerHeight =
      rect.height >= 52 && rect.width >= 80
        ? 20
        : rect.height >= 36 && rect.width >= 56
          ? 16
          : 0;
    const tileWidth = Math.max(0, rect.width - 2);
    const tileHeight = Math.max(0, rect.height - 2 - headerHeight);

    const tileNodes =
      tileWidth > 0 && tileHeight > 0
        ? squarify(
            node.item.tiles.map((tile) => ({ item: tile, weight: tile.weight })),
            { x: 0, y: 0, width: tileWidth, height: tileHeight }
          )
        : [];

    boxes.push({
      sector: node.item,
      rect,
      headerHeight,
      tileWidth,
      tileHeight,
      tiles: tileNodes.map((tileNode) => ({
        tile: tileNode.item,
        x: tileNode.x,
        y: tileNode.y,
        width: tileNode.width,
        height: tileNode.height,
      })),
    });
  }

  return boxes;
}
