export interface ChangeSurface {
  background: string;
  border: string;
  /** Ink for the tile's ticker/percentage. Computed per fill so a near-white neutral tile
   *  gets dark text and a deep red one gets light text, instead of one ink that is
   *  unreadable at one end of the scale. */
  text: string;
  dashed: boolean;
}

/**
 * Seven discrete steps per direction, anchored on the colours TradingView's own S&P 500
 * board uses. Discrete bins are the point: a smooth wash makes a −1.1% and a −1.4%
 * company indistinguishable, and comparing those two at a glance is the whole job of the
 * board. Near-flat names read as a light neutral instead of a faint red/green tint, so
 * the eye goes straight to what actually moved.
 */
const NEUTRAL_FILL = "#c9c9c9";

/** Mild → severe. */
const DOWN_STEPS = ["#f7b0b2", "#f78a8e", "#f2636a", "#e8404b", "#c92c39", "#9b1f2b"];
const UP_STEPS = ["#8ed8b0", "#5fcb96", "#35bc7c", "#16a866", "#067a48", "#076637"];

/** Upper edge of each coloured band, in |%|. Anything below the first edge is neutral. */
const BAND_EDGES = [0.2, 0.5, 1, 1.5, 2, 2.5];

const DARK_INK = "var(--bg)";
const LIGHT_INK = "var(--text-primary)";
/**
 * Crossover between the two inks, solved rather than guessed: the ink with the better
 * contrast ratio flips where (L + 0.05)² = (L_light + 0.05)(L_dark + 0.05). With this
 * palette that lands at L ≈ 0.16 — picking 0.22 (a common eyeball value) puts light text
 * on the mid red `#e8404b` at a 3.4:1 ratio, which is genuinely hard to read.
 */
const INK_THRESHOLD = 0.16;

function channelLuminance(value: number): number {
  const channel = value / 255;
  return channel <= 0.03928
    ? channel / 12.92
    : Math.pow((channel + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  );
}

function surfaceFor(fill: string): ChangeSurface {
  return {
    background: fill,
    border: `color-mix(in srgb, ${fill} 76%, #000)`,
    text: relativeLuminance(fill) > INK_THRESHOLD ? DARK_INK : LIGHT_INK,
    dashed: false,
  };
}

/** 0 = neutral, 1..6 = progressively stronger. */
function bandIndex(magnitude: number): number {
  if (magnitude < BAND_EDGES[0]) return 0;
  for (let index = BAND_EDGES.length - 1; index >= 0; index -= 1) {
    if (magnitude >= BAND_EDGES[index]) return index + 1;
  }
  return 0;
}

const UNKNOWN_SURFACE: ChangeSurface = {
  background: "color-mix(in srgb, var(--text-muted) 5%, var(--panel-2))",
  border: "var(--seam-bright)",
  text: "var(--text-primary)",
  dashed: true,
};

/**
 * The full-market map's scale: a fixed ±3% range matching the footer legend, banded into
 * discrete steps so neighbouring companies never look identical.
 */
export function marketChangeSurface(changePercent: number | null): ChangeSurface {
  if (changePercent === null || !Number.isFinite(changePercent)) return UNKNOWN_SURFACE;

  const band = bandIndex(Math.abs(changePercent));
  if (band === 0) return surfaceFor(NEUTRAL_FILL);

  const steps = changePercent > 0 ? UP_STEPS : DOWN_STEPS;
  return surfaceFor(steps[band - 1]);
}

/**
 * The 36-stock sample's scale. It mixes into `panel-2` rather than using flat fills, so
 * the result is always a dark wash and light ink is correct at every step.
 */
export function changeSurface(
  changePercent: number | null,
  scaleMax: number
): ChangeSurface {
  if (changePercent === null || !Number.isFinite(changePercent)) return UNKNOWN_SURFACE;
  if (Math.abs(changePercent) < 0.005) {
    return {
      background: "var(--panel-2)",
      border: "var(--seam)",
      text: "var(--text-primary)",
      dashed: false,
    };
  }

  const magnitude = Math.min(Math.abs(changePercent) / Math.max(scaleMax, 0.5), 1);
  const color = changePercent > 0 ? "var(--up)" : "var(--down)";
  const alpha = Math.round(10 + 42 * Math.pow(magnitude, 0.85));
  return {
    background: `color-mix(in srgb, ${color} ${alpha}%, var(--panel-2))`,
    border: `color-mix(in srgb, ${color} ${Math.min(72, alpha + 18)}%, var(--seam))`,
    text: "var(--text-primary)",
    dashed: false,
  };
}
