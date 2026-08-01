"use client";

export function TrendBars({
  data,
  color,
  formatValue,
}: {
  data: { label: string; value: number | null }[];
  color: string;
  formatValue: (v: number) => string;
}) {
  const values = data.map((d) => d.value ?? 0);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const width = 100;
  const height = 46;
  const barWidth = width / data.length;
  const zeroY = height - ((0 - min) / range) * height;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height: 90 }} preserveAspectRatio="none">
        {data.map((d, i) => {
          if (d.value === null) return null;
          const barHeight = (Math.abs(d.value) / range) * height;
          const y = d.value >= 0 ? zeroY - barHeight : zeroY;
          return (
            <rect
              key={i}
              x={i * barWidth + barWidth * 0.18}
              y={y}
              width={barWidth * 0.64}
              height={Math.max(barHeight, 0.6)}
              fill={color}
              opacity={i === data.length - 1 ? 1 : 0.55}
              rx={0.5}
            />
          );
        })}
      </svg>
      <div className="flex justify-between telemetry text-[9px] text-text-muted mt-1">
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
