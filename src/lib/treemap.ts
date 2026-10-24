/**
 * A small, dependency-free squarified treemap. The heatmap uses it twice: once to
 * divide the canvas between sectors, then again to divide each sector between its
 * stocks. Squarifying keeps tiles close to square, which is what makes the labels
 * readable at the sizes a 36-name map produces.
 */
export interface TreemapRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TreemapItem<T> {
  item: T;
  weight: number;
}

export interface TreemapNode<T> extends TreemapRect {
  item: T;
}

interface AreaItem<T> {
  item: T;
  area: number;
}

function worstRatio(areas: number[], side: number, total: number): number {
  const max = Math.max(...areas);
  const min = Math.min(...areas);
  const sideSquared = side * side;
  return Math.max(
    (sideSquared * max) / (total * total),
    (total * total) / (sideSquared * min)
  );
}

/**
 * Lays one row (a run of items that already won the aspect-ratio test) along the
 * shorter side of the remaining rectangle, and returns the rectangle left over.
 */
function layoutRow<T>(
  row: AreaItem<T>[],
  rect: TreemapRect,
  rowArea: number
): { nodes: TreemapNode<T>[]; rest: TreemapRect } {
  const nodes: TreemapNode<T>[] = [];

  if (rect.width >= rect.height) {
    const columnWidth = rowArea / rect.height;
    let y = rect.y;
    row.forEach((entry, index) => {
      const isLast = index === row.length - 1;
      const height = isLast ? rect.y + rect.height - y : entry.area / columnWidth;
      nodes.push({
        item: entry.item,
        x: rect.x,
        y,
        width: columnWidth,
        height,
      });
      y += height;
    });
    return {
      nodes,
      rest: {
        x: rect.x + columnWidth,
        y: rect.y,
        width: Math.max(0, rect.width - columnWidth),
        height: rect.height,
      },
    };
  }

  const rowHeight = rowArea / rect.width;
  let x = rect.x;
  row.forEach((entry, index) => {
    const isLast = index === row.length - 1;
    const width = isLast ? rect.x + rect.width - x : entry.area / rowHeight;
    nodes.push({
      item: entry.item,
      x,
      y: rect.y,
      width,
      height: rowHeight,
    });
    x += width;
  });
  return {
    nodes,
    rest: {
      x: rect.x,
      y: rect.y + rowHeight,
      width: rect.width,
      height: Math.max(0, rect.height - rowHeight),
    },
  };
}

export function squarify<T>(
  items: readonly TreemapItem<T>[],
  rect: TreemapRect
): TreemapNode<T>[] {
  const usable = items.filter(
    (entry) => Number.isFinite(entry.weight) && entry.weight > 0
  );
  if (usable.length === 0 || rect.width <= 0 || rect.height <= 0) return [];

  const totalWeight = usable.reduce((sum, entry) => sum + entry.weight, 0);
  if (!(totalWeight > 0)) return [];

  const areaScale = (rect.width * rect.height) / totalWeight;
  const remainingItems: AreaItem<T>[] = [...usable]
    .sort((a, b) => b.weight - a.weight)
    .map((entry) => ({ item: entry.item, area: entry.weight * areaScale }));

  const nodes: TreemapNode<T>[] = [];
  let remaining = rect;
  let row: AreaItem<T>[] = [];
  let rowArea = 0;
  let index = 0;

  while (index < remainingItems.length) {
    if (remaining.width <= 1e-6 || remaining.height <= 1e-6) break;

    const next = remainingItems[index];
    const side = Math.min(remaining.width, remaining.height);

    if (row.length === 0) {
      row = [next];
      rowArea = next.area;
      index += 1;
      continue;
    }

    const currentWorst = worstRatio(
      row.map((entry) => entry.area),
      side,
      rowArea
    );
    const nextWorst = worstRatio(
      [...row.map((entry) => entry.area), next.area],
      side,
      rowArea + next.area
    );

    if (nextWorst <= currentWorst) {
      row.push(next);
      rowArea += next.area;
      index += 1;
      continue;
    }

    const laidOut = layoutRow(row, remaining, rowArea);
    nodes.push(...laidOut.nodes);
    remaining = laidOut.rest;
    row = [];
    rowArea = 0;
  }

  if (row.length > 0 && remaining.width > 0 && remaining.height > 0) {
    nodes.push(...layoutRow(row, remaining, rowArea).nodes);
  }

  return nodes;
}
