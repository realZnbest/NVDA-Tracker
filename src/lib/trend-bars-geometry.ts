/**
 * Pure geometry for the quarterly trend bars so the layout can be tested without
 * rendering React. Coordinates live in the SVG's viewBox space (default 100 x 46).
 */

export interface BarRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BarGeometry {
  zeroY: number;
  bars: (BarRect | null)[];
}

const VIEW_WIDTH = 100;
const VIEW_HEIGHT = 46;

export function computeBarGeometry(
  values: (number | null)[],
  width = VIEW_WIDTH,
  height = VIEW_HEIGHT
): BarGeometry {
  const nums = values.map((v) => v ?? 0);
  const max = Math.max(...nums, 0);
  const min = Math.min(...nums, 0);
  const range = max - min || 1;
  const maxAbs = Math.max(max, -min) || 1;
  const barWidth = width / Math.max(values.length, 1);

  // A zero crossing only exists when the series actually contains both signs.
  // For a single-sign series the old proportional baseline collapsed onto the
  // top edge (all negative) or the bottom edge (all positive), which made the
  // whole chart look upside down. Anchor those on the bottom and scale by the
  // largest magnitude; the value label already prints the sign.
  const diverging = max > 0 && min < 0;
  const zeroY = diverging ? height - (-min / range) * height : height;

  return {
    zeroY,
    bars: values.map((value, i) => {
      if (value === null) return null;
      const barHeight = (Math.abs(value) / (diverging ? range : maxAbs)) * height;
      return {
        x: i * barWidth + barWidth * 0.18,
        y: diverging && value < 0 ? zeroY : zeroY - barHeight,
        width: barWidth * 0.64,
        height: Math.max(barHeight, 0.6),
      };
    }),
  };
}
