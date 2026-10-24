"use client";

import Link from "next/link";
import { memo, useMemo, useState } from "react";

import { layoutHeatmap } from "@/lib/heatmap-layout";
import { formatMarketCap, formatPercent } from "@/lib/heatmap-format";
import {
  layoutMobileBoard,
  layoutMobileSector,
} from "@/lib/market-mobile-layout";
import {
  marketChangeSurface,
  type ChangeSurface,
} from "@/lib/heatmap-surface";
import type {
  MarketSectorGroup,
  WeightedMarketTile,
} from "@/lib/market-heatmap-model";
import { useElementSize } from "@/lib/use-element-size";
import { IconChevronLeft } from "./icons";

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
      <MarketTileContent tile={tile} width={width} height={height} ink={surface.text} />
    </Link>
  );
});

/** Progressive tile label: logo, ticker and percentage appear only once the box is big
 *  enough to hold them, so a 12px tile never prints a clipped "−0.9…". */
function MarketTileContent({
  tile,
  width,
  height,
  ink,
}: {
  tile: WeightedMarketTile;
  width: number;
  height: number;
  /** Ink colour for this tile's fill, so light neutrals and deep reds stay readable. */
  ink: string;
}) {
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

  return (
    <>
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
        <span className={`max-w-full truncate font-semibold ${tickerClass}`} style={{ color: ink }}>
          {tile.symbol}
        </span>
      ) : null}
      {showPercent ? (
        <span
          className={`telemetry max-w-full truncate font-medium ${percentClass}`}
          style={{ color: ink }}
        >
          {formatPercent(tile.changePercent)}
        </span>
      ) : null}
    </>
  );
}

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

function tileLabel(tile: WeightedMarketTile): string {
  return `${tile.symbol} · ${tile.name} · ${formatPercent(tile.changePercent)} · ${formatMarketCap(tile.marketCap)}`;
}

function tileSurface(tile: WeightedMarketTile): ChangeSurface {
  return marketChangeSurface(tile.changePercent);
}

function MobileTile({
  tile,
  x,
  y,
  width,
  height,
}: {
  tile: WeightedMarketTile;
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  const surface = tileSurface(tile);
  return (
    <Link
      href={`/dashboard/${encodeURIComponent(tile.symbol)}`}
      aria-label={tileLabel(tile)}
      title={tileLabel(tile)}
      className="absolute flex flex-col items-center justify-center gap-0.5 overflow-hidden border px-0.5 text-center leading-none transition-[filter] duration-100 active:brightness-125"
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
      <MarketTileContent tile={tile} width={width} height={height} ink={surface.text} />
    </Link>
  );
}

/** Sector labels on the phone are a compact caption strip, not the desktop header bar:
 *  they sit on the panel ground so the coloured mosaic stays unbroken, the way the
 *  reference board reads. */
function MobileSectorLabel({
  sector,
  width,
  height,
}: {
  sector: MarketSectorGroup;
  width: number;
  height: number;
}) {
  const showChange = width >= 92;
  return (
    <div className="flex items-center justify-between gap-1 overflow-hidden" style={{ height }}>
      <span className="min-w-0 truncate text-[9px] font-medium text-text-secondary">
        {sector.shortLabel}
      </span>
      {showChange ? (
        <span
          className="telemetry shrink-0 text-[9px]"
          style={{ color: groupChangeColor(sector.changePercent) }}
        >
          {formatPercent(sector.changePercent)}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Phone view of the whole index. The desktop wall squarifies sectors across a landscape
 * canvas; a phone cannot show 500 tiles at once in a readable size, so the board keeps
 * TradingView's own structure — every sector as a proportional cell on one square canvas,
 * largest top-left — and each sector is a button that drills into that sector alone.
 * The mosaic still encodes market cap by area; the drill-down is what makes the tickers
 * big enough to read.
 */
export function MarketHeatmapMobile({
  sectors,
  size,
}: {
  sectors: MarketSectorGroup[];
  /** Square canvas edge in CSS px (width is capped by the viewport separately). */
  size: number;
}) {
  const [ref, box] = useElementSize<HTMLDivElement>();
  const [openSectorId, setOpenSectorId] = useState<string | null>(null);
  const width = box.width || 0;
  const canvasHeight = width > 0 ? width : size;

  const blocks = useMemo(
    () => layoutMobileBoard(sectors, width, canvasHeight),
    [sectors, width, canvasHeight]
  );
  const openSector = openSectorId
    ? (sectors.find((sector) => sector.id === openSectorId) ?? null)
    : null;
  const drilled = useMemo(
    () => (openSector ? layoutMobileSector(openSector, width, canvasHeight) : null),
    [openSector, width, canvasHeight]
  );

  return (
    <div className="border border-seam/70 bg-panel-2">
      <div className="flex items-center gap-2 border-b border-seam/70 px-2 py-1.5">
        {openSector ? (
          <button
            type="button"
            onClick={() => setOpenSectorId(null)}
            className="inline-flex items-center gap-1 rounded-sm border border-seam bg-panel px-1.5 py-0.5 text-[10px] text-text-secondary transition-colors hover:text-text-primary"
          >
            <IconChevronLeft className="h-3 w-3" />
            ทั้งหมด
          </button>
        ) : (
          <span className="text-[10px] text-text-muted">
            {sectors.length} กลุ่ม · แตะกลุ่มเพื่อดูหุ้นทั้งหมด
          </span>
        )}
        <span className="ml-auto min-w-0 truncate text-[10px] text-text-secondary">
          {openSector ? openSector.label : ""}
        </span>
      </div>

      <div ref={ref} className="relative w-full" style={{ height: canvasHeight }}>
        {drilled ? (
          <div
            className="absolute"
            style={{
              left: drilled.rect.x,
              top: drilled.rect.y,
              width: drilled.rect.width,
              height: drilled.rect.height,
            }}
          >
            {drilled.labelHeight > 0 ? (
              <div className="absolute inset-x-0 top-0">
                <MobileSectorLabel
                  sector={drilled.sector}
                  width={drilled.rect.width}
                  height={drilled.labelHeight}
                />
              </div>
            ) : null}
            <div className="absolute inset-x-0 bottom-0" style={{ top: drilled.labelHeight }}>
              {drilled.tiles.map((tileBox) => (
                <MobileTile
                  key={tileBox.tile.symbol}
                  tile={tileBox.tile}
                  x={tileBox.x}
                  y={tileBox.y}
                  width={tileBox.width}
                  height={tileBox.height}
                />
              ))}
            </div>
          </div>
        ) : (
          blocks.map((block) => (
            <section
              key={block.sector.id}
              className="absolute"
              aria-label={`${block.sector.label} ${formatPercent(block.sector.changePercent)}`}
              style={{
                left: block.rect.x,
                top: block.rect.y,
                width: block.rect.width,
                height: block.rect.height,
              }}
            >
              <button
                type="button"
                onClick={() => setOpenSectorId(block.sector.id)}
                className="absolute inset-0 z-10 flex items-start text-left"
                aria-label={`เปิดกลุ่ม ${block.sector.label} ${block.sector.tiles.length} หุ้น`}
              >
                {block.labelHeight > 0 ? (
                  <span className="w-full px-0.5">
                    <MobileSectorLabel
                      sector={block.sector}
                      width={block.rect.width}
                      height={block.labelHeight}
                    />
                  </span>
                ) : null}
              </button>
              <div className="absolute inset-x-0 bottom-0" style={{ top: block.labelHeight }}>
                {block.tiles.map((tileBox) => {
                  const surface = tileSurface(tileBox.tile);
                  return (
                    <span
                      key={tileBox.tile.symbol}
                      aria-hidden="true"
                      className="absolute border"
                      style={{
                        left: tileBox.x,
                        top: tileBox.y,
                        width: tileBox.width,
                        height: tileBox.height,
                        background: surface.background,
                        borderColor: surface.border,
                        borderStyle: surface.dashed ? "dashed" : "solid",
                      }}
                    >
                      {tileBox.width >= 48 && tileBox.height >= 30 ? (
                        <span className="flex h-full w-full flex-col items-center justify-center gap-0.5 overflow-hidden text-center leading-none">
                          <MarketTileContent
                            tile={tileBox.tile}
                            width={tileBox.width}
                            height={tileBox.height}
                            ink={surface.text}
                          />
                        </span>
                      ) : null}
                    </span>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}

