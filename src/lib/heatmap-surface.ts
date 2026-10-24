export interface ChangeSurface {
  background: string;
  border: string;
  dashed: boolean;
}

/**
 * Tile fill carries the day's direction; the sign in the text carries it again, so the
 * map never relies on colour alone. The scale is capped at ±scaleMax so a single
 * outlier can't wash out every other tile.
 */
export function changeSurface(
  changePercent: number | null,
  scaleMax: number
): ChangeSurface {
  if (changePercent === null || !Number.isFinite(changePercent)) {
    return {
      background: "color-mix(in srgb, var(--text-muted) 5%, var(--panel-2))",
      border: "var(--seam-bright)",
      dashed: true,
    };
  }
  if (Math.abs(changePercent) < 0.005) {
    return {
      background: "var(--panel-2)",
      border: "var(--seam)",
      dashed: false,
    };
  }

  const magnitude = Math.min(Math.abs(changePercent) / Math.max(scaleMax, 0.5), 1);
  const color = changePercent > 0 ? "var(--up)" : "var(--down)";
  const alpha = Math.round(10 + 42 * Math.pow(magnitude, 0.85));
  return {
    background: `color-mix(in srgb, ${color} ${alpha}%, var(--panel-2))`,
    border: `color-mix(in srgb, ${color} ${Math.min(72, alpha + 18)}%, var(--seam))`,
    dashed: false,
  };
}

/**
 * The full-market map uses the same direction colours but a stronger fill: with 500
 * tiles, the individual blocks are smaller and a muted wash would make a -2% company
 * look almost neutral. The fixed ±3% scale matches the legend in the footer.
 */
export function marketChangeSurface(changePercent: number | null): ChangeSurface {
  if (changePercent === null || !Number.isFinite(changePercent)) {
    return {
      background: "color-mix(in srgb, var(--text-muted) 5%, var(--panel-2))",
      border: "var(--seam-bright)",
      dashed: true,
    };
  }
  if (Math.abs(changePercent) < 0.005) {
    return {
      background: "var(--panel-2)",
      border: "var(--seam)",
      dashed: false,
    };
  }

  const magnitude = Math.min(Math.abs(changePercent) / 3, 1);
  // TradingView's near-zero tiles read as neutral, not as a faint red/green wash.
  // A small dead band also stops a -0.14% mega-cap from painting half a sector red.
  const neutralBand = 0.08;
  const normalized = Math.max(0, (magnitude - neutralBand) / (1 - neutralBand));
  const alpha = Math.round(4 + 76 * Math.pow(normalized, 0.9));
  if (alpha <= 4) {
    return {
      background: "var(--panel-2)",
      border: "var(--seam)",
      dashed: false,
    };
  }
  const color = changePercent > 0 ? "var(--up)" : "var(--down)";
  return {
    background: `color-mix(in srgb, ${color} ${alpha}%, var(--panel-2))`,
    border: `color-mix(in srgb, ${color} ${Math.min(88, alpha + 12)}%, var(--seam))`,
    dashed: false,
  };
}
