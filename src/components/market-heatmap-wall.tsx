"use client";

import Link from "next/link";
import { memo, useMemo } from "react";

import { layoutHeatmap } from "@/lib/heatmap-layout";
import { formatMarketCap, formatPercent } from "@/lib/heatmap-format";
import { marketChangeSurface } from "@/lib/heatmap-surface";
import type {
  MarketSectorGroup,
  WeightedMarketTile,
} from "@/lib/market-heatmap-model";
import { useElementSize } from "@/lib/use-element-size";

interface MarketTileBox {
  tile: WeightedMarketTile;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface MarketSectorBox {
  sector: MarketSectorGroup;
  rect: { x: number; y: number; width: number; height: number };
  headerHeight: number;
  tileWidth: number;
  tileHeight: number;
  tiles: MarketTileBox[];
}

function groupChangeColor(value: number | null): string {
  // A +0.01% group header should not look confidently green while most of its tiles
  // are red. Treat tiny group moves as neutral; the tile colours carry the detail.
  if (value === null || Math.abs(value) < 0.1) return "var(--text-secondary)";
  return value > 0 ? "var(--up)" : "var(--down)";
}

const MarketTile = memo(function MarketTile({
  tile,
  x,
  y,
  width,
  height,
  onHover,
}: {
  tile: WeightedMarketTile;
  x: number;
  y: number;
  width: number;
  height: number;
  onHover: (symbol: string | null) => void;
}) {
  const surface = marketChangeSurface(tile.changePercent);
  const showLogo = Boolean(tile.logoUrl) && width >= 46 && height >= 46;
  const showTicker = width >= 26 && height >= 16;
  const showPercent = width >= 42 && height >= 26;
  const logoSize = Math.min(44, Math.max(18, Math.round(Math.min(width, height) * 0.3)));
  const tickerClass =
    width >= 160 ? "text-sm" : width >= 90 ? "text-[11px]" : "text-[9px]";
  const percentClass =
    width >= 180
      ? "text-2xl"
      : width >= 120
        ? "text-lg"
        : width >= 70
          ? "text-xs"
          : "text-[10px]";
  const label = `${tile.symbol} · ${tile.name} · ${formatPercent(tile.changePercent)} · ${formatMarketCap(tile.marketCap)}`;

  return (
    <Link
      href={`/dashboard/${encodeURIComponent(tile.symbol)}`}
      aria-label={label}
      title={label}
      onMouseEnter={() => onHover(tile.symbol)}
      onFocus={() => onHover(tile.symbol)}
      className="absolute flex flex-col items-center justify-center gap-0.5 overflow-hidden border px-0.5 text-center leading-none transition-[filter] duration-100 hover:z-10 hover:brightness-110 focus-visible:z-10 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-2px] focus-visible:outline-text-primary"
      style={{
        left: x,
        top: y,
        width,
        height,
        background: surface.background,
        borderColor: surface.border,
        borderStyle: surface.dashed ? "dashed" : "solid",
      }}
    >
      {showLogo && tile.logoUrl ? (
        <img
          src={tile.logoUrl}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          className="shrink-0 rounded-[2px] object-contain"
          style={{ width: logoSize, height: logoSize }}
        />
      ) : null}
      {showTicker ? (
        <span className={`max-w-full truncate font-semibold text-text-primary ${tickerClass}`}>
          {tile.symbol}
        </span>
      ) : null}
      {showPercent ? (
        <span
          className={`telemetry max-w-full truncate font-medium text-text-primary ${percentClass}`}
        >
          {formatPercent(tile.changePercent)}
        </span>
      ) : null}
    </Link>
  );
});

export function MarketHeatmapWall({
  sectors,
  minSectorShare,
  fullscreen = false,
  onHover,
}: {
  sectors: MarketSectorGroup[];
  minSectorShare: number;
  fullscreen?: boolean;
  onHover: (symbol: string | null) => void;
}) {
  const [ref, size] = useElementSize<HTMLDivElement>();
  const boxes = useMemo(
    () =>
      layoutHeatmap(sectors, size.width, size.height, minSectorShare) as unknown as
        MarketSectorBox[],
    [sectors, size.width, size.height, minSectorShare]
  );

  return (
    <div
      ref={ref}
      onMouseLeave={() => onHover(null)}
      className={`relative w-full overflow-hidden border border-seam/70 bg-bg ${
        fullscreen
          ? "h-full"
          : "h-[clamp(520px,calc(100dvh-20rem),900px)]"
      }`}
    >
      {boxes.map((box) => {
        const { sector, rect, headerHeight, tiles } = box;
        return (
          <section
            key={sector.id}
            aria-label={`${sector.label} ${formatPercent(sector.changePercent)}`}
            className="absolute flex flex-col overflow-hidden rounded-[1px] border border-seam/70 bg-panel-2"
            style={{
              left: rect.x,
              top: rect.y,
              width: rect.width,
              height: rect.height,
            }}
          >
            {headerHeight > 0 ? (
              <div
                className="flex shrink-0 items-center justify-between gap-1.5 border-b border-seam/60 bg-bg/70 px-1.5"
                style={{ height: headerHeight }}
              >
                <span
                  className="min-w-0 truncate text-[10px] font-medium text-text-secondary"
                  title={sector.label}
                >
                  {sector.shortLabel}
                </span>
                {rect.width >= 96 ? (
                  <span
                    className="telemetry shrink-0 text-[9px]"
                    style={{ color: groupChangeColor(sector.changePercent) }}
                  >
                    {formatPercent(sector.changePercent)}
                  </span>
                ) : null}
              </div>
            ) : null}
            <div className="relative min-h-0 flex-1 overflow-hidden">
              {tiles.map((tileBox) =>
                tileBox.width >= 1 && tileBox.height >= 1 ? (
                  <MarketTile
                    key={tileBox.tile.symbol}
                    tile={tileBox.tile}
                    x={tileBox.x}
                    y={tileBox.y}
                    width={tileBox.width}
                    height={tileBox.height}
                    onHover={onHover}
                  />
                ) : null
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** A phone-friendly summary: the full 500-tile treemap is unreadable at 390px, so the
 *  mobile board keeps the sector hierarchy and shows each group's largest companies. */
export function MarketHeatmapMobile({ sectors }: { sectors: MarketSectorGroup[] }) {
  return (
    <div className="overflow-hidden border border-seam/70 bg-panel-2">
      <div className="border-b border-seam/70 px-2 py-2 text-[9px] text-text-muted">
        มุมมองมือถือแสดง 6 หุ้นใหญ่ต่อกลุ่ม · เรียงตามมูลค่าตลาด
      </div>
      {sectors.map((sector) => (
        <section key={sector.id} className="border-b border-seam/70 last:border-b-0">
          <div className="flex items-center justify-between gap-2 px-2 py-2">
            <div className="min-w-0">
              <h3 className="truncate text-[11px] font-medium text-text-secondary">
                {sector.label}
              </h3>
              <p className="telemetry text-[9px] text-text-muted">
                {sector.tiles.length} หุ้น
              </p>
            </div>
            <span
              className="telemetry shrink-0 text-xs"
              style={{ color: groupChangeColor(sector.changePercent) }}
            >
              {formatPercent(sector.changePercent)}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 px-2 pb-2">
            {sector.tiles.slice(0, 6).map((tile) => {
              const surface = marketChangeSurface(tile.changePercent);
              const label = `${tile.symbol} · ${tile.name} · ${formatPercent(tile.changePercent)}`;
              return (
                <Link
                  key={tile.symbol}
                  href={`/dashboard/${encodeURIComponent(tile.symbol)}`}
                  aria-label={label}
                  title={label}
                  className="flex min-w-0 items-center justify-between gap-1 rounded-[2px] border px-1.5 py-1.5"
                  style={{
                    background: surface.background,
                    borderColor: surface.border,
                    borderStyle: surface.dashed ? "dashed" : "solid",
                  }}
                >
                  <span className="telemetry min-w-0 truncate text-[10px] font-semibold text-text-primary">
                    {tile.symbol}
                  </span>
                  <span className="telemetry shrink-0 text-[10px] text-text-primary">
                    {formatPercent(tile.changePercent)}
                  </span>
                </Link>
              );
            })}
          </div>
          {sector.tiles.length > 6 ? (
            <p className="px-2 pb-2 text-[9px] text-text-muted">
              แสดง 6 จาก {sector.tiles.length} หุ้น · ดูทั้งหมดบนเดสก์ท็อป
            </p>
          ) : null}
        </section>
      ))}
    </div>
  );
}
