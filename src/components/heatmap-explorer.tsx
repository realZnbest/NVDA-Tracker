"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sectorLabel } from "@/lib/heatmap-universe";
import { HeatmapView } from "./heatmap-view";
import { SectorHeatmapView } from "./sector-heatmap-view";
import { IconChevronDown } from "./icons";

/**
 * The public heatmap is sector-first: the eleven-industry ICB overview owns the page, and
 * the fixed 36-stock board is a disclosure below it. A sector tile opens the disclosure
 * with that sector's stocks already filtered, so the primary view never asks the owner to
 * scan a mega-cap sample just to answer "which sectors are moving?".
 */
export function HeatmapExplorer({ stockCount }: { stockCount: number }) {
  const [stockOpen, setStockOpen] = useState(false);
  const [stockSector, setStockSector] = useState<string | null>(null);
  const stockRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

  const openStocks = useCallback((sector: string | null) => {
    setStockSector(sector);
    setStockOpen(true);
  }, []);

  useEffect(() => {
    // Scroll when the disclosure first opens or when a sector tile picks a new
    // filter; clearing the filter back to all stocks should not yank the page.
    const shouldScroll = stockOpen && (!wasOpen.current || stockSector !== null);
    wasOpen.current = stockOpen;
    if (!shouldScroll) return;
    const frame = window.requestAnimationFrame(() => {
      stockRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [stockOpen, stockSector]);

  return (
    <div className="flex flex-col gap-4">
      <SectorHeatmapView onSelectSector={(sectorId) => openStocks(sectorId)} />

      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="max-w-2xl text-[11px] leading-relaxed text-text-muted">
          ต้องการดูรายตัว? มุมมองหุ้นเป็นตัวอย่าง {stockCount} หุ้นใหญ่
          ไม่ใช่ตัวแทนตลาด
        </p>
        <button
          type="button"
          onClick={() => {
            if (stockOpen) setStockOpen(false);
            else openStocks(stockSector);
          }}
          aria-expanded={stockOpen}
          aria-controls="stock-detail"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-sm border border-seam bg-panel px-3 py-1.5 text-xs text-text-secondary transition-colors hover:border-seam-bright hover:text-text-primary"
        >
          {stockOpen
            ? "ซ่อนรายละเอียดหุ้น"
            : stockSector
              ? `ดูหุ้นในกลุ่ม${sectorLabel(stockSector)}`
              : "เปิดรายละเอียดหุ้น"}
          <IconChevronDown
            className={`h-3.5 w-3.5 transition-transform ${
              stockOpen ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>

      {stockOpen && (
        <div id="stock-detail" ref={stockRef} className="scroll-mt-20">
          <HeatmapView
            sectorFilter={stockSector}
            onClearSector={() => setStockSector(null)}
          />
        </div>
      )}
    </div>
  );
}
