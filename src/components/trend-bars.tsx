"use client";

import { computeBarGeometry } from "@/lib/trend-bars-geometry";

export function TrendBars({
  data,
  color,
  formatValue,
}: {
  data: { label: string; value: number | null }[];
  color: string;
  formatValue: (v: number) => string;
}) {
  const { bars } = computeBarGeometry(data.map((d) => d.value));
  const width = 100;
  const height = 46;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height: 90 }} preserveAspectRatio="none">
        {bars.map((bar, i) =>
          bar ? (
            <rect
              key={i}
              x={bar.x}
              y={bar.y}
              width={bar.width}
              height={bar.height}
              fill={color}
              opacity={i === data.length - 1 ? 1 : 0.55}
              rx={0.5}
            />
          ) : null
        )}
      </svg>
      <div className="flex justify-between telemetry text-[0.5625rem] text-text-muted mt-1">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
      <div className="telemetry text-sm mt-1" style={{ color }}>
        {data[data.length - 1]?.value !== null
          ? formatValue(data[data.length - 1].value as number)
          : "—"}
      </div>
    </div>
  );
}
