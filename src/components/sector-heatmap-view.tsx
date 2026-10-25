"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SectorHeatmapResponse } from "@/lib/types";
import {
  buildSectorHeatmapModel,
  type SectorHeatmapModel,
  type WeightedSector,
} from "@/lib/sector-heatmap-model";
import { SECTOR_WEIGHT_AS_OF } from "@/lib/heatmap-universe";
import { changeColor, formatPercent, formatPrice } from "@/lib/heatmap-format";
import { usePoll } from "@/lib/use-poll";
import { HeatmapLegend } from "./heatmap-legend";
import { MobileSectorHeatmap, SectorTreemap } from "./sector-heatmap";
import { SessionBadge } from "./session-badge";
import { IconArrowDown, IconArrowUp, IconRefresh } from "./icons";

const LIVE_REFRESH_MS = 60_000;
const CLOSED_REFRESH_MS = 5 * 60_000;

function Readout({
  model,
  sector,
}: {
  model: SectorHeatmapModel;
  sector: WeightedSector | null;
}) {
  return (
    <div className="flex min-h-[34px] flex-wrap items-center gap-x-3 gap-y-1 border-b border-seam/60 px-3 py-1.5 sm:px-4">
      {sector ? (
        <>
          <span className="text-xs font-medium text-text-primary">
            {sector.label}
          </span>
          <span className="telemetry text-[10px] text-text-muted">
            {sector.etf}
          </span>
          <span className="telemetry text-[11px] text-text-primary">
            {formatPrice(sector.price)}{" "}
            <span className="text-text-muted">USD</span>
          </span>
          <span
            className="telemetry text-[11px] font-medium"
            style={{ color: changeColor(sector.changePercent) }}
          >
            {formatPercent(sector.changePercent)}
          </span>
          <span className="text-[11px] text-text-muted">
            น้ำหนักตลาด{" "}
            <span className="telemetry text-text-secondary">
              {sector.marketWeight.toFixed(1)}%
            </span>
          </span>
          <span className="ml-auto hidden shrink-0 text-[10px] text-text-muted sm:inline">
            คลิกเพื่อดูหุ้นในกลุ่ม
          </span>
        </>
      ) : (
        <>
          <span className="text-[11px] text-text-secondary">
            ภาพรวม {model.sectors.length} กลุ่ม
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-text-muted">
            <IconArrowUp className="h-3 w-3 text-up" />
            ขึ้น <span className="telemetry text-up">{model.advancers}</span> กลุ่ม
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-text-muted">
            <IconArrowDown className="h-3 w-3 text-down" />
            ลง <span className="telemetry text-down">{model.decliners}</span> กลุ่ม
          </span>
          {model.flat > 0 && (
            <span className="text-[11px] text-text-muted">
              ทรงตัว{" "}
              <span className="telemetry text-text-secondary">{model.flat}</span>{" "}
              กลุ่ม
            </span>
          )}
          {model.unknown > 0 && (
            <span className="text-[11px] text-text-muted">
              ไม่มีข้อมูล{" "}
              <span className="telemetry text-text-secondary">
                {model.unknown}
              </span>{" "}
              กลุ่ม
            </span>
          )}
          <span aria-hidden="true" className="hidden h-3 w-px bg-seam sm:block" />
          <span
            className="text-[11px] text-text-muted"
            title="เฉลี่ยถ่วงด้วยน้ำหนักกลุ่มใน Russell 1000 (ICB)"
          >
            ตลาดโดยรวม{" "}
            <span
              className="telemetry font-medium"
              style={{ color: changeColor(model.weightedChange) }}
            >
              {formatPercent(model.weightedChange)}
            </span>
          </span>
          {model.leader && (
            <span className="hidden items-center gap-1 text-[10px] text-text-muted xl:inline-flex">
              นำ{" "}
              <span className="text-text-secondary">
                {model.leader.shortLabel}
              </span>
              <span className="telemetry" style={{ color: "var(--up)" }}>
                {formatPercent(model.leader.changePercent)}
              </span>
            </span>
          )}
          {model.laggard && (
            <span className="hidden items-center gap-1 text-[10px] text-text-muted xl:inline-flex">
              ร่วง{" "}
              <span className="text-text-secondary">
                {model.laggard.shortLabel}
              </span>
              <span className="telemetry" style={{ color: "var(--down)" }}>
                {formatPercent(model.laggard.changePercent)}
              </span>
            </span>
          )}
        </>
      )}
    </div>
  );
}

function SectorFooter({ data }: { data: SectorHeatmapResponse }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-seam/60 px-3 py-2 text-[10px] text-text-muted sm:px-4">
      <span>
        พื้นที่ = น้ำหนักกลุ่ม Russell 1000 ตาม ICB โดยประมาณ ({SECTOR_WEIGHT_AS_OF}) ·
        สี = % เปลี่ยนแปลงของ ETF กลุ่ม
      </span>
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>ETF iShares · ราคา Yahoo Finance</span>
        {data.failedSymbols.length > 0 && (
          <span
            className="text-down"
            title={data.failedSymbols.join(", ")}
          >
            ETF ไม่พร้อม {data.failedSymbols.length} ตัว
          </span>
        )}
        <span className="text-text-secondary">คลิกกลุ่มเพื่อดูหุ้นใหญ่</span>
      </span>
    </div>
  );
}

function SectorHeatmapSkeleton() {
  return (
    <section className="module overflow-hidden" aria-busy="true">
      <div className="flex flex-wrap items-center gap-3 border-b border-seam px-3 py-2.5 sm:px-4">
        <span className="module-label">SECTOR MAP</span>
        <span className="h-4 w-14 animate-pulse rounded bg-white/[0.05]" />
        <span className="ml-auto h-3 w-28 animate-pulse rounded bg-white/[0.04]" />
      </div>
      <div className="p-1.5 sm:p-2">
        <div className="grid h-[clamp(500px,calc(100dvh-18rem),820px)] grid-cols-4 grid-rows-3 gap-1">
          {[
            "col-span-2 row-span-2",
            "col-span-2 row-span-1",
            "col-span-1 row-span-1",
            "col-span-1 row-span-1",
            "col-span-2 row-span-1",
            "col-span-1 row-span-1",
            "col-span-1 row-span-1",
            "col-span-2 row-span-1",
          ].map((span, index) => (
            <div
              key={index}
              className={`animate-pulse rounded-[2px] bg-white/[0.04] ${span}`}
            />
          ))}
        </div>
      </div>
      <p className="border-t border-seam/60 px-3 py-2 text-[10px] text-text-muted sm:px-4">
        กำลังดึงราคา ETF กลุ่มจาก Yahoo Finance…
      </p>
    </section>
  );
}

function SectorHeatmapError({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  const message =
    error === "HEATMAP_UNAVAILABLE"
      ? "Yahoo Finance ไม่ตอบสนองในขณะนี้ — ตรวจการเชื่อมต่อแล้วลองอีกครั้ง"
      : error === "FETCH_FAILED"
        ? "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — ตรวจเครือข่ายแล้วลองอีกครั้ง"
        : "ดึงภาพรวมกลุ่มไม่สำเร็จ — ลองอีกครั้ง";

  return (
    <section className="module p-5 sm:p-6">
      <p className="module-label">SECTOR MAP</p>
      <h2 className="mt-2 text-base font-medium text-text-primary">
        โหลดภาพรวมกลุ่มไม่สำเร็จ
      </h2>
      <p className="mt-1 max-w-xl text-sm leading-relaxed text-text-muted">
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-sm bg-ch-price-dim px-3 py-1.5 text-xs font-medium text-ch-price transition-colors hover:brightness-125"
      >
        ลองอีกครั้ง
      </button>
    </section>
  );
}

export function SectorHeatmapView({
  onSelectSector,
}: {
  onSelectSector: (sectorId: string) => void;
}) {
  const [data, setData] = useState<SectorHeatmapResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [stale, setStale] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const hasData = useRef(false);

  const load = useCallback(async (mode: "initial" | "manual" | "poll" = "initial") => {
    if (mode !== "poll") setRefreshing(true);
    try {
      const res = await fetch("/api/heatmap/sectors", { cache: "no-store" });
      const payload = (await res.json().catch(() => null)) as
        | (SectorHeatmapResponse & { error?: string })
        | null;

      if (!res.ok || !payload || !Array.isArray(payload.sectors)) {
        if (hasData.current) {
          setStale(true);
          return;
        }
        setError(payload?.error ?? "HEATMAP_UNAVAILABLE");
        setStatus("error");
        return;
      }

      hasData.current = true;
      setData(payload);
      setStatus("ready");
      setError(null);
      setStale(false);
    } catch {
      if (hasData.current) {
        setStale(true);
        return;
      }
      setError("FETCH_FAILED");
      setStatus("error");
    } finally {
      if (mode !== "poll") setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load("initial");
  }, [load]);

  const refreshMs =
    data?.session === "closed" ? CLOSED_REFRESH_MS : LIVE_REFRESH_MS;
  usePoll(() => load("poll"), refreshMs, {
    enabled: data !== null,
    leading: false,
  });

  const model = useMemo(
    () => (data ? buildSectorHeatmapModel(data.sectors) : null),
    [data]
  );
  const hoveredSector = hovered
    ? (model?.sectors.find((sector) => sector.id === hovered) ?? null)
    : null;
  const asOfLabel = data
    ? new Date(data.asOf).toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : null;

  if (!data && status === "loading") return <SectorHeatmapSkeleton />;
  if (!data && status === "error") {
    return <SectorHeatmapError error={error} onRetry={() => void load("initial")} />;
  }
  if (!data || !model) return null;

  return (
    <section
      className="module overflow-hidden"
      aria-label="ฮีตแมปกลุ่มอุตสาหกรรมตลาดสหรัฐฯ"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-seam px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="module-label">SECTOR MAP</span>
          <SessionBadge session={data.session} />
          <span className="text-[10px] text-text-muted">
            {model.sectors.length} กลุ่ม
          </span>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-2">
          <HeatmapLegend
            scaleMax={model.scaleMax}
            title="สีเขียว = กลุ่มปรับขึ้น · สีแดง = กลุ่มปรับลง เทียบราคาปิดก่อนหน้า"
          />
          <span className="telemetry text-[10px] text-text-muted">
            {asOfLabel ? `อัปเดต ${asOfLabel}` : "—"}
          </span>
          {stale && <span className="text-[10px] text-down">อัปเดตไม่สำเร็จ</span>}
          <button
            type="button"
            onClick={() => void load("manual")}
            disabled={refreshing}
            aria-label="รีเฟรชภาพรวมกลุ่ม"
            className="rounded p-1 text-text-muted transition-colors hover:text-text-primary disabled:opacity-50"
          >
            <IconRefresh
              className={`h-3.5 w-3.5 ${refreshing ? "animate-spin motion-reduce:animate-none" : ""}`}
            />
          </button>
        </div>
      </div>

      <Readout model={model} sector={hoveredSector} />

      <div className="p-1.5 sm:p-2">
        <div className="hidden lg:block">
          <SectorTreemap
            sectors={model.sectors}
            scaleMax={model.scaleMax}
            onHover={setHovered}
            onSelect={onSelectSector}
          />
        </div>
        <div className="lg:hidden">
          <MobileSectorHeatmap
            sectors={model.sectors}
            scaleMax={model.scaleMax}
            onHover={setHovered}
            onSelect={onSelectSector}
          />
        </div>
      </div>

      <SectorFooter data={data} />
    </section>
  );
}
