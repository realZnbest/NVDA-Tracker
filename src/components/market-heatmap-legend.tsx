"use client";

import { marketChangeSurface } from "@/lib/heatmap-surface";

const STEPS = [-3, -2, -1, 0, 1, 2, 3] as const;

function stepLabel(step: number): string {
  if (step === 0) return "0%";
  return step > 0 ? `+${step}%` : `${step}%`;
}

/** Discrete swatches make the fixed ±3% colour scale legible at a glance. The same
 *  marketChangeSurface function paints the tiles, so the legend cannot drift from them. */
export function MarketHeatmapLegend() {
  return (
    <div
      className="flex items-end gap-1"
      role="img"
      aria-label="สเกลสี -3% ถึง +3%: แดงคือลบ เขียวคือบวก"
      title="สเกลสี: แดง = ลบ, เขียว = บวก, สูงสุด ±3%"
    >
      {STEPS.map((step) => {
        const surface = marketChangeSurface(step);
        return (
          <div key={step} className="flex flex-col items-center gap-1">
            <span className="telemetry text-[8px] leading-none text-text-muted">
              {stepLabel(step)}
            </span>
            <span
              aria-hidden="true"
              className="h-2 w-7 rounded-[1px] border border-seam/70 sm:w-9"
              style={{ background: surface.background }}
            />
          </div>
        );
      })}
    </div>
  );
}
