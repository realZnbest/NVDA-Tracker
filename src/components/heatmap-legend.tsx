export function HeatmapLegend({
  scaleMax,
  title,
}: {
  scaleMax: number;
  title: string;
}) {
  return (
    <span className="flex items-center gap-1.5" title={title}>
      <span className="telemetry text-[9px] text-down">-{scaleMax}%</span>
      <span
        aria-hidden="true"
        className="h-1.5 w-16 rounded-full sm:w-20"
        style={{
          background:
            "linear-gradient(90deg, color-mix(in srgb, var(--down) 65%, var(--panel-2)) 0%, var(--panel-2) 50%, color-mix(in srgb, var(--up) 65%, var(--panel-2)) 100%)",
        }}
      />
      <span className="telemetry text-[9px] text-up">+{scaleMax}%</span>
    </span>
  );
}
