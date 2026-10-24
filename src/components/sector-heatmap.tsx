"use client";

import { useMemo } from "react";
import type { WeightedSector } from "@/lib/sector-heatmap-model";
import { layoutSectorHeatmap } from "@/lib/sector-heatmap-layout";
import { changeColor, formatPercent, formatPrice } from "@/lib/heatmap-format";
import { changeSurface } from "@/lib/heatmap-surface";
import { useElementSize } from "@/lib/use-element-size";

interface SectorMapProps {
  sectors: WeightedSector[];
  scaleMax: number;
  onHover: (sectorId: string | null) => void;
  onSelect: (sectorId: string) => void;
}

function sectorAriaLabel(sector: WeightedSector): string {
  const price =
    sector.price === null
      ? "ไม่มีข้อมูลราคา ETF"
      : `ราคา ETF ${formatPrice(sector.price)} ดอลลาร์`;
  return `${sector.label} ETF ${sector.etf} ${price} เปลี่ยนแปลง ${formatPercent(sector.changePercent)} น้ำหนักตลาด Russell 1000 ${sector.marketWeight.toFixed(1)}% — คลิกเพื่อดูหุ้นในกลุ่ม`;
}

function SectorTileButton({
  sector,
  x,
  y,
  width,
  height,
  scaleMax,
  onHover,
  onSelect,
}: {
  sector: WeightedSector;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleMax: number;
  onHover: (sectorId: string | null) => void;
  onSelect: (sectorId: string) => void;
}) {
  const surface = changeSurface(sector.changePercent, scaleMax);
  const showLabel = width >= 38 && height >= 26;
  const showEtf = width >= 60 && height >= 50;
  const showPercent = width >= 56 && height >= 54;
  const showWeight = width >= 84 && height >= 70;

  const paddingClass = width < 80 ? "p-1.5" : width < 160 ? "p-2" : "p-3";
  // The sector map is the primary view, so its type runs one step larger than the
  // stock detail's tiles at the same box size. The largest block (technology) carries
  // the market's weight; its label and change should read from across the room.
  const labelClass =
    width >= 300 ? "text-base" : width >= 130 ? "text-xs" : "text-[10px]";
  const percentClass =
    width >= 300
      ? "text-3xl"
      : width >= 190
        ? "text-2xl"
        : width >= 110
          ? "text-xl"
          : "text-lg";

  return (
    <button
      type="button"
      aria-label={sectorAriaLabel(sector)}
      onMouseEnter={() => onHover(sector.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(sector.id)}
      onBlur={() => onHover(null)}
      onClick={() => onSelect(sector.id)}
      className="absolute overflow-hidden rounded-[2px] border text-left text-text-primary transition-[filter] duration-150 hover:brightness-110 focus-visible:brightness-125"
      style={{
        left: x + 0.5,
        top: y + 0.5,
        width: Math.max(0, width - 1),
        height: Math.max(0, height - 1),
        background: surface.background,
        borderColor: surface.border,
        borderStyle: surface.dashed ? "dashed" : "solid",
      }}
    >
      <span
        className={`flex h-full flex-col justify-between overflow-hidden ${paddingClass}`}
      >
        <span className="min-w-0">
          {showLabel && (
            <span
              className={`block truncate font-medium leading-tight text-text-primary ${labelClass}`}
            >
              {sector.label}
            </span>
          )}
          {showEtf && (
            <span className="telemetry mt-0.5 block truncate text-[9px] leading-none text-text-primary/65">
              {sector.etf}
            </span>
          )}
        </span>
        <span className="min-w-0">
          {showPercent && (
            <span
              className={`telemetry block truncate font-semibold leading-none text-text-primary ${percentClass}`}
            >
              {formatPercent(sector.changePercent)}
            </span>
          )}
          {showWeight && (
            <span className="telemetry mt-1 block truncate text-[10px] leading-none text-text-primary/70">
              น้ำหนัก {sector.marketWeight.toFixed(1)}%
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

/**
 * Desktop sector map: eleven blocks sized by approximate Russell 1000 ICB weight. The
 * whole surface is a button — clicking a sector is the drill-down into its stock sample.
 */
export function SectorTreemap({
  sectors,
  scaleMax,
  onHover,
  onSelect,
}: SectorMapProps) {
  const [ref, size] = useElementSize<HTMLDivElement>();
  const boxes = useMemo(
    () => layoutSectorHeatmap(sectors, size.width, size.height),
    [sectors, size.width, size.height]
  );

  return (
    <div
      ref={ref}
      onMouseLeave={() => onHover(null)}
      aria-label="แผนที่กลุ่มอุตสาหกรรมตลาดสหรัฐฯ"
      className="relative h-[clamp(500px,calc(100dvh-18rem),820px)] w-full overflow-hidden rounded-[2px] border border-seam/70 bg-bg"
    >
      {boxes.length === 0 ? (
        <p className="absolute inset-0 flex items-center justify-center text-xs text-text-muted">
          กำลังจัดวางแผนที่…
        </p>
      ) : (
        boxes.map((box) => (
          <SectorTileButton
            key={box.sector.id}
            sector={box.sector}
            x={box.rect.x}
            y={box.rect.y}
            width={box.rect.width}
            height={box.rect.height}
            scaleMax={scaleMax}
            onHover={onHover}
            onSelect={onSelect}
          />
        ))
      )}
    </div>
  );
}

function MobileSectorRow({
  sector,
  onHover,
  onSelect,
}: {
  sector: WeightedSector;
  onHover: (sectorId: string | null) => void;
  onSelect: (sectorId: string) => void;
}) {
  const color = changeColor(sector.changePercent);
  const barWidth = Math.max(2, sector.marketWeight);

  return (
    <button
      type="button"
      aria-label={sectorAriaLabel(sector)}
      onMouseEnter={() => onHover(sector.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(sector.id)}
      onBlur={() => onHover(null)}
      onClick={() => onSelect(sector.id)}
      className="flex w-full items-center gap-3 border-t border-seam/50 px-2.5 py-2 text-left transition-colors hover:bg-white/[0.025] focus-visible:bg-white/[0.04]"
    >
      <span className="telemetry w-10 shrink-0 text-[9px] text-text-muted">
        {sector.etf}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] leading-tight text-text-secondary">
          {sector.label}
        </span>
        <span className="mt-1 block h-1 overflow-hidden rounded-full bg-seam/60">
          <span
            className="block h-full rounded-full"
            style={{ width: `${barWidth}%`, backgroundColor: color }}
          />
        </span>
      </span>
      <span className="telemetry w-10 shrink-0 text-right text-[10px] text-text-muted">
        {sector.marketWeight.toFixed(1)}%
      </span>
      <span
        className="telemetry w-14 shrink-0 text-right text-xs font-medium"
        style={{ color }}
      >
        {formatPercent(sector.changePercent)}
      </span>
    </button>
  );
}

/**
 * Phone layout: a compact market-weight table rather than a shrunken treemap. The
 * numeric weight is the exact share; the bar is a quick proportional cue, not a second
 * scale. Every row is a drill-down button.
 */
export function MobileSectorHeatmap({
  sectors,
  onHover,
  onSelect,
}: SectorMapProps) {
  return (
    <div
      aria-label="ตารางกลุ่มอุตสาหกรรมตลาดสหรัฐฯ"
      className="overflow-hidden rounded-[2px] border border-seam/70 bg-bg"
    >
      <div className="flex items-center gap-3 border-b border-seam/60 bg-panel-2/60 px-2.5 py-1.5 text-[9px] text-text-muted">
        <span className="w-10 shrink-0">ETF</span>
        <span className="flex-1">กลุ่มอุตสาหกรรม</span>
        <span className="w-10 shrink-0 text-right">น้ำหนัก</span>
        <span className="w-14 shrink-0 text-right">เปลี่ยน</span>
      </div>
      {sectors.map((sector) => (
        <MobileSectorRow
          key={sector.id}
          sector={sector}
          onHover={onHover}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
