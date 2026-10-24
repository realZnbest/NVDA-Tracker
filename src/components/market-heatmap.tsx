"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { HeatmapSectorGroup, WeightedHeatmapTile } from "@/lib/heatmap-model";
import { layoutHeatmap } from "@/lib/heatmap-layout";
import {
  changeColor,
  formatMarketCap,
  formatPercent,
  formatPrice,
} from "@/lib/heatmap-format";
import { changeSurface } from "@/lib/heatmap-surface";
import { useElementSize } from "@/lib/use-element-size";

interface MarketMapProps {
  sectors: HeatmapSectorGroup[];
  scaleMax: number;
  onHover: (symbol: string | null) => void;
}

function tileAriaLabel(tile: WeightedHeatmapTile): string {
  const price =
    tile.price === null
      ? "ไม่มีข้อมูลราคา"
      : `ราคา ${formatPrice(tile.price)} ดอลลาร์`;
  return `${tile.symbol} ${tile.name} ${price} เปลี่ยนแปลง ${formatPercent(tile.changePercent)} มูลค่าตลาด ${formatMarketCap(tile.marketCap)}`;
}

function HeatmapTileLink({
  tile,
  x,
  y,
  width,
  height,
  scaleMax,
  onHover,
}: {
  tile: WeightedHeatmapTile;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleMax: number;
  onHover: (symbol: string | null) => void;
}) {
  const surface = changeSurface(tile.changePercent, scaleMax);
  const showTicker = width >= 24 && height >= 18;
  const showPercent = width >= 56 && height >= 32;
  const showName = width >= 110 && height >= 64;
  const showPrice = width >= 94 && height >= 64;

  // Type scales with the box so a wall-sized NVDA tile doesn't carry phone-sized
  // telemetry, and a 26px sliver still manages to show its ticker. The width
  // thresholds are chosen from the rendered width of "−0.00%" in Plex Mono.
  const paddingClass =
    width < 44 ? "p-1" : width < 90 ? "p-1.5" : "p-2";
  const tickerClass =
    width >= 140
      ? "text-sm"
      : width >= 72
        ? "text-xs"
        : width >= 44
          ? "text-[10px]"
          : "text-[9px]";
  const percentClass =
    width >= 280
      ? "text-lg"
      : width >= 140
        ? "text-base"
        : width >= 78
          ? "text-sm"
          : width >= 60
            ? "text-[11px]"
            : "text-[10px]";

  return (
    <Link
      href={`/dashboard/${encodeURIComponent(tile.symbol)}`}
      prefetch={false}
      aria-label={tileAriaLabel(tile)}
      onMouseEnter={() => onHover(tile.symbol)}
      onFocus={() => onHover(tile.symbol)}
      onBlur={() => onHover(null)}
      className="absolute overflow-hidden rounded-[2px] border text-text-primary transition-[filter] duration-150 hover:brightness-110 focus-visible:brightness-125"
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
      {showTicker && (
        <div
          className={`flex h-full flex-col overflow-hidden ${paddingClass} ${
            showPercent ? "justify-between" : "justify-center"
          }`}
        >
          <p
            className={`telemetry truncate font-semibold leading-none text-text-primary ${tickerClass}`}
          >
            {tile.symbol}
          </p>
          {showPercent && (
            <div className="min-w-0">
              {showName && (
                <p className="mb-1 truncate text-[10px] leading-tight text-text-primary/55">
                  {tile.name}
                </p>
              )}
              <p
                className={`telemetry truncate font-semibold leading-none text-text-primary ${percentClass}`}
              >
                {formatPercent(tile.changePercent)}
              </p>
              {showPrice && (
                <p className="telemetry mt-1 truncate text-[10px] leading-none text-text-primary/60">
                  {formatPrice(tile.price)}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </Link>
  );
}

function MobileHeatmapTile({
  tile,
  scaleMax,
  maxWeight,
  onHover,
}: {
  tile: WeightedHeatmapTile;
  scaleMax: number;
  maxWeight: number;
  onHover: (symbol: string | null) => void;
}) {
  const surface = changeSurface(tile.changePercent, scaleMax);

  return (
    <Link
      href={`/dashboard/${encodeURIComponent(tile.symbol)}`}
      prefetch={false}
      aria-label={tileAriaLabel(tile)}
      onMouseEnter={() => onHover(tile.symbol)}
      onFocus={() => onHover(tile.symbol)}
      onBlur={() => onHover(null)}
      className="flex h-14 flex-col justify-between overflow-hidden rounded-[2px] border p-1.5 transition-[filter] active:brightness-125"
      style={{
        flex: `${Math.max(0.15, tile.weight / Math.max(maxWeight, 1))} 1 0px`,
        minWidth: 68,
        background: surface.background,
        borderColor: surface.border,
        borderStyle: surface.dashed ? "dashed" : "solid",
      }}
    >
      <span className="telemetry truncate text-[10px] font-semibold leading-none text-text-primary">
        {tile.symbol}
      </span>
      <span
        className={`telemetry truncate text-[11px] font-medium leading-none ${
          tile.changePercent === null ? "text-text-muted" : "text-text-primary"
        }`}
      >
        {formatPercent(tile.changePercent)}
      </span>
    </Link>
  );
}

/**
 * Desktop market map: a squarified treemap of sectors, then of stocks inside each
 * sector. Tiles are absolutely placed in content-box coordinates measured by
 * ResizeObserver, so the mosaic reflows correctly from a laptop to a 2200px wall.
 */
export function MarketTreemap({ sectors, scaleMax, onHover }: MarketMapProps) {
  const [ref, size] = useElementSize<HTMLDivElement>();
  const boxes = useMemo(
    () => layoutHeatmap(sectors, size.width, size.height),
    [sectors, size.width, size.height]
  );

  return (
    <div
      ref={ref}
      onMouseLeave={() => onHover(null)}
      aria-label="แผนที่ตลาดหุ้นใหญ่สหรัฐฯ"
      className="relative h-[clamp(520px,calc(100dvh-17rem),860px)] w-full overflow-hidden rounded-[2px] border border-seam/70 bg-bg"
    >
      {boxes.length === 0 ? (
        <p className="absolute inset-0 flex items-center justify-center text-xs text-text-muted">
          กำลังจัดวางแผนที่…
        </p>
      ) : (
        boxes.map((box) => (
          <section
            key={box.sector.id}
            aria-label={`กลุ่ม${box.sector.label}`}
            className="absolute flex flex-col overflow-hidden rounded-[2px] border border-seam/70 bg-panel-2"
            style={{
              left: box.rect.x,
              top: box.rect.y,
              width: box.rect.width,
              height: box.rect.height,
            }}
          >
            {box.headerHeight > 0 && (
              <div
                className={`flex shrink-0 items-center justify-between gap-2 border-b border-seam/50 bg-bg/45 ${
                  box.headerHeight >= 20 ? "px-1.5" : "px-1"
                }`}
                style={{ height: box.headerHeight }}
              >
                <span
                  title={box.sector.label}
                  className={`truncate font-medium text-text-secondary ${
                    box.headerHeight >= 20 ? "text-[10px]" : "text-[9px]"
                  }`}
                >
                  {box.rect.width >= 200
                    ? box.sector.label
                    : box.sector.shortLabel}
                </span>
                <span
                  className="telemetry shrink-0 text-[9px]"
                  style={{ color: changeColor(box.sector.changePercent) }}
                >
                  {formatPercent(box.sector.changePercent)}
                </span>
              </div>
            )}

            <div className="relative w-full" style={{ height: box.tileHeight }}>
              {box.tiles.map((tileBox) => (
                <HeatmapTileLink
                  key={tileBox.tile.symbol}
                  tile={tileBox.tile}
                  x={tileBox.x}
                  y={tileBox.y}
                  width={tileBox.width}
                  height={tileBox.height}
                  scaleMax={scaleMax}
                  onHover={onHover}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

/**
 * Compact market map: sectors stay grouped vertically and tiles share each row in
 * proportion to market cap. A true treemap at phone width would leave most labels
 * unreadable, while a flat grid would throw away the size signal entirely.
 */
export function MobileMarketHeatmap({ sectors, scaleMax, onHover }: MarketMapProps) {
  return (
    <div
      aria-label="แผนที่ตลาดหุ้นใหญ่สหรัฐฯ"
      onMouseLeave={() => onHover(null)}
    >
      {sectors.map((sector) => {
        const maxWeight = sector.tiles.reduce((max, tile) => Math.max(max, tile.weight), 0);
        return (
          <section
            key={sector.id}
            aria-label={`กลุ่ม${sector.label}`}
            className="border-t border-seam/50 first:border-t-0"
          >
            <div className="flex items-center justify-between gap-2 px-2.5 pb-1.5 pt-2">
              <div className="flex min-w-0 items-baseline gap-1.5">
                <h2 className="truncate text-[11px] font-medium text-text-secondary">
                  {sector.label}
                </h2>
                <span className="telemetry text-[9px] text-text-muted">
                  {sector.tiles.length}
                </span>
              </div>
              <span
                className="telemetry shrink-0 text-[10px]"
                style={{ color: changeColor(sector.changePercent) }}
              >
                {formatPercent(sector.changePercent)}
              </span>
            </div>
            <div className="flex flex-wrap gap-1 px-2 pb-2">
              {sector.tiles.map((tile) => (
                <MobileHeatmapTile
                  key={tile.symbol}
                  tile={tile}
                  scaleMax={scaleMax}
                  maxWeight={maxWeight}
                  onHover={onHover}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
