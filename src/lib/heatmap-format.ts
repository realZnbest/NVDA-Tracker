/** Formatters shared by the heatmap tiles and its telemetry readout. Kept free of
 *  React so the same text rules apply everywhere a value appears. */

export function formatPrice(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const normalized = Math.abs(value) < 0.005 ? 0 : value;
  return `${normalized > 0 ? "+" : ""}${normalized.toFixed(2)}%`;
}

export function formatMarketCap(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value <= 0) return "—";
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

export function changeColor(value: number | null): string {
  if (value === null || Math.abs(value) < 0.005) return "var(--text-secondary)";
  return value > 0 ? "var(--up)" : "var(--down)";
}
