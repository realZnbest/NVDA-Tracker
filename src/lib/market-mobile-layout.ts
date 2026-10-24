import type { MarketSectorGroup, WeightedMarketTile } from "./market-heatmap-model";
import { squarify, type TreemapRect } from "./treemap";

export interface MobileTileBox {
  tile: WeightedMarketTile;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MobileSectorBlock {
  sector: MarketSectorGroup;
  /** The whole cell, label strip included. */
  rect: TreemapRect;
  labelHeight: number;
  /** Tile canvas, relative to the cell origin (i.e. below the label strip). */
  canvas: TreemapRect;
  tiles: MobileTileBox[];
}

function labelHeightFor(rect: TreemapRect): number {
  if (rect.width < 54) return 0;
  if (rect.height >= 96) return 20;
  if (rect.height >= 56) return 16;
  if (rect.height >= 34) return 13;
  return 0;
}

function buildBlock(
  sector: MarketSectorGroup,
  node: TreemapRect,
  labelHeight: number
): MobileSectorBlock | null {
  // 1px seam between neighbouring cells, matching the desktop wall's inset.
  const rect = {
    x: node.x + 1,
    y: node.y + 1,
    width: Math.max(0, node.width - 2),
    height: Math.max(0, node.height - 2),
  };
  if (rect.width < 4 || rect.height < 4) return null;

  const canvas = {
    x: 0,
    y: labelHeight,
    width: rect.width,
    height: Math.max(0, rect.height - labelHeight),
  };

  const tiles =
    canvas.width > 0 && canvas.height > 0
      ? squarify(
          sector.tiles.map((tile) => ({ item: tile, weight: tile.weight })),
          { x: 0, y: 0, width: canvas.width, height: canvas.height }
        )
      : [];

  return {
    sector,
    rect,
    labelHeight,
    canvas,
    tiles: tiles.map((node2) => ({
      tile: node2.item,
      x: node2.x,
      y: node2.y,
      width: node2.width,
      height: node2.height,
    })),
  };
}

/**
 * The phone board mirrors TradingView's own S&P 500 heatmap: the whole index fits in one
 * near-square canvas, sectors are squarified into rows beside each other (the two biggest
 * share the top row, so the largest company really does sit top-left), and each sector's
 * *area* — not its height in a stack — encodes its share of the index.
 *
 * A sector that fell below the floor would collapse to a hairline, so the floored weights
 * drive the cross-sector split only; tiles inside a sector always use raw market caps,
 * exactly like the desktop wall.
 */
export function layoutMobileBoard(
  sectors: MarketSectorGroup[],
  width: number,
  height: number,
  minSectorShare = 0.008
): MobileSectorBlock[] {
  if (sectors.length === 0 || width <= 0 || height <= 0) return [];

  const totalWeight = sectors.reduce((sum, sector) => sum + sector.weight, 0);
  if (!(totalWeight > 0)) return [];
  const floor = totalWeight * minSectorShare;

  const nodes = squarify(
    sectors.map((sector) => ({ item: sector, weight: Math.max(sector.weight, floor) })),
    { x: 0, y: 0, width, height }
  );

  const blocks: MobileSectorBlock[] = [];
  for (const node of nodes) {
    const block = buildBlock(node.item, node, labelHeightFor(node));
    if (block) blocks.push(block);
  }
  return blocks;
}

/** One sector filling the whole canvas — the drill-down the overview's tap opens. Every
 *  company gets the room its market cap earns, so the tickers become readable. */
export function layoutMobileSector(
  sector: MarketSectorGroup,
  width: number,
  height: number
): MobileSectorBlock | null {
  if (width <= 0 || height <= 0) return null;
  const labelHeight = height >= 120 ? 24 : 18;
  return buildBlock(sector, { x: 0, y: 0, width, height }, labelHeight);
}
