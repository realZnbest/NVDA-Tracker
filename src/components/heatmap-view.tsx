"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HeatmapResponse } from "@/lib/types";
import {
  buildHeatmapModel,
  type HeatmapModel,
  type WeightedHeatmapTile,
} from "@/lib/heatmap-model";
import { sectorLabel } from "@/lib/heatmap-universe";
import {
  changeColor,
  formatMarketCap,
  formatPercent,
  formatPrice,
} from "@/lib/heatmap-format";
import { usePoll } from "@/lib/use-poll";
import { HeatmapLegend } from "./heatmap-legend";
import { MarketTreemap, MobileMarketHeatmap } from "./market-heatmap";
import { SessionBadge } from "./session-badge";
import { IconArrowDown, IconArrowUp, IconInfo, IconRefresh } from "./icons";

const LIVE_REFRESH_MS = 60_000;
const CLOSED_REFRESH_MS = 5 * 60_000;

function Readout({
  model,
  tile,
  scopeLabel,
}: {
  model: HeatmapModel;
  tile: WeightedHeatmapTile | null;
  scopeLabel?: string | null;
}) {
  return (
    <div className="flex min-h-[34px] flex-wrap items-center gap-x-3 gap-y-1 border-b border-seam/60 px-3 py-1.5 sm:px-4">
      {tile ? (
        <>
          <span className="telemetry text-xs font-semibold text-text-primary">
            {tile.symbol}
          </span>
          <span className="hidden max-w-[220px] truncate text-[11px] text-text-muted sm:inline">
            {tile.name}
          </span>
          <span className="telemetry text-[11px] text-text-primary">
            {formatPrice(tile.price)} <span className="text-text-muted">USD</span>
          </span>
          <span
            className="telemetry text-[11px] font-medium"
            style={{ color: changeColor(tile.changePercent) }}
          >
            {formatPercent(tile.changePercent)}
          </span>
          <span
            className="text-[11px] text-text-muted"
            title={tile.marketCap === null ? "ไม่มีข้อมูลมูลค่าตลาดสำหรับหุ้นตัวนี้" : undefined}
          >
            มูลค่าตลาด{" "}
            <span className="telemetry text-text-secondary">
              {formatMarketCap(tile.marketCap)}
            </span>
          </span>
          <span className="ml-auto shrink-0 text-[10px] text-text-muted">
            {sectorLabel(tile.sector)}
          </span>
        </>
      ) : (
        <>
          <span className="text-[11px] text-text-secondary">
            {scopeLabel ?? "ภาพรวม"}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-text-muted">
            <IconArrowUp className="h-3 w-3 text-up" />
            ขึ้น <span className="telemetry text-up">{model.advancers}</span>
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-text-muted">
            <IconArrowDown className="h-3 w-3 text-down" />
            ลง <span className="telemetry text-down">{model.decliners}</span>
          </span>
          <span className="text-[11px] text-text-muted">
            ทรงตัว{" "}
            <span className="telemetry text-text-secondary">{model.flat}</span>
          </span>
          {model.unknown > 0 && (
            <span className="text-[11px] text-text-muted">
              ไม่มีข้อมูล{" "}
              <span className="telemetry text-text-secondary">{model.unknown}</span>
            </span>
          )}
          <span aria-hidden="true" className="hidden h-3 w-px bg-seam sm:block" />
          <span
            className="text-[11px] text-text-muted"
            title="เฉลี่ยถ่วงน้ำหนักด้วยมูลค่าตลาด"
          >
            เฉลี่ยถ่วงน้ำหนัก{" "}
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
              <span className="telemetry text-text-secondary">{model.leader.symbol}</span>
              <span className="telemetry" style={{ color: "var(--up)" }}>
                {formatPercent(model.leader.changePercent)}
              </span>
            </span>
          )}
          {model.laggard && (
            <span className="hidden items-center gap-1 text-[10px] text-text-muted xl:inline-flex">
              ร่วง{" "}
              <span className="telemetry text-text-secondary">{model.laggard.symbol}</span>
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

function HeatmapFooter({
  data,
  model,
}: {
  data: HeatmapResponse;
  model: HeatmapModel;
}) {
  const visibleSymbols = new Set(model.tiles.map((tile) => tile.symbol));
  const missingCaps = model.tiles.filter((tile) => tile.marketCap === null).length;
  const failedVisible = data.failedSymbols.filter((symbol) =>
    visibleSymbols.has(symbol)
  ).length;

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-seam/60 px-3 py-2 text-[10px] text-text-muted sm:px-4">
      <span>
        ขนาดพื้นที่ = มูลค่าตลาด
        {model.totalMarketCap !== null
          ? ` (รวม ${formatMarketCap(model.totalMarketCap)})`
          : ""}{" "}
        · สี = % เปลี่ยนแปลงจากราคาปิดก่อนหน้า
      </span>
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>ราคา Yahoo Finance · มูลค่าตลาด Finnhub</span>
        {failedVisible > 0 && (
          <span className="text-down">ไม่มีราคา {failedVisible} ตัว</span>
        )}
        {!data.marketCapAvailable ? (
          <span className="inline-flex items-start gap-1 text-text-secondary">
            <IconInfo className="mt-px h-3 w-3 shrink-0" />
            ยังโหลดมูลค่าตลาดไม่ได้ — ตรวจ FINNHUB_API_KEY หรือโควตาคีย์
            แล้วขนาดพื้นที่จะเท่ากันแทน
          </span>
        ) : missingCaps > 0 ? (
          <span>ไม่มีมูลค่าตลาด {missingCaps} ตัว — ใช้ค่ากลางจัดขนาด</span>
        ) : null}
      </span>
    </div>
  );
}

function HeatmapSkeleton() {
  return (
    <section className="module overflow-hidden" aria-busy="true">
      <div className="flex flex-wrap items-center gap-3 border-b border-seam px-3 py-2.5 sm:px-4">
        <span className="module-label">STOCK DETAIL</span>
        <span className="h-4 w-14 animate-pulse rounded bg-white/[0.05]" />
        <span className="ml-auto h-3 w-28 animate-pulse rounded bg-white/[0.04]" />
      </div>
      <div className="p-1.5 sm:p-2">
        <div className="grid h-[clamp(520px,calc(100dvh-17rem),860px)] grid-cols-4 grid-rows-5 gap-1">
          {[
            "col-span-2 row-span-2",
            "col-span-2 row-span-1",
            "col-span-1 row-span-1",
            "col-span-1 row-span-1",
            "col-span-2 row-span-1",
            "col-span-1 row-span-2",
            "col-span-1 row-span-2",
            "col-span-2 row-span-1",
            "col-span-1 row-span-1",
            "col-span-1 row-span-1",
            "col-span-1 row-span-1",
            "col-span-1 row-span-1",
          ].map((span, index) => (
            <div
              key={index}
              className={`animate-pulse rounded-[2px] bg-white/[0.04] ${span}`}
            />
          ))}
        </div>
      </div>
      <p className="border-t border-seam/60 px-3 py-2 text-[10px] text-text-muted sm:px-4">
        กำลังดึงราคาจาก Yahoo Finance และมูลค่าตลาดจาก Finnhub…
      </p>
    </section>
  );
}

function HeatmapError({
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
        : "ดึงข้อมูลตลาดไม่สำเร็จ — ลองอีกครั้ง";

  return (
    <section className="module p-5 sm:p-6">
      <p className="module-label">STOCK DETAIL</p>
      <h2 className="mt-2 text-base font-medium text-text-primary">
        โหลดรายละเอียดหุ้นไม่สำเร็จ
      </h2>
      <p className="mt-1 max-w-xl text-sm leading-relaxed text-text-muted">{message}</p>
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

interface HeatmapViewProps {
  /** When set, the detail view only renders this sector's stocks. */
  sectorFilter?: string | null;
  onClearSector?: () => void;
}

export function HeatmapView({
  sectorFilter = null,
  onClearSector,
}: HeatmapViewProps) {
  const [data, setData] = useState<HeatmapResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [stale, setStale] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const hasData = useRef(false);

  const load = useCallback(async (mode: "initial" | "manual" | "poll" = "initial") => {
    if (mode !== "poll") setRefreshing(true);
    try {
      const res = await fetch("/api/heatmap", { cache: "no-store" });
      const payload = (await res.json().catch(() => null)) as
        | (HeatmapResponse & { error?: string })
        | null;

      if (!res.ok || !payload || !Array.isArray(payload.tiles)) {
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
  usePoll(() => void load("poll"), refreshMs, {
    enabled: data !== null,
    leading: false,
  });

  const model = useMemo(() => {
    if (!data) return null;
    const tiles = sectorFilter
      ? data.tiles.filter((tile) => tile.sector === sectorFilter)
      : data.tiles;
    return buildHeatmapModel(tiles);
  }, [data, sectorFilter]);
  const hoveredTile = hovered
    ? (model?.tiles.find((tile) => tile.symbol === hovered) ?? null)
    : null;
  const asOfLabel = data
    ? new Date(data.asOf).toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : null;

  if (!data && status === "loading") return <HeatmapSkeleton />;
  if (!data && status === "error") {
    return <HeatmapError error={error} onRetry={() => void load("initial")} />;
  }
  if (!data || !model) return null;

  return (
    <section className="module overflow-hidden" aria-label="ฮีตแมปหุ้นใหญ่สหรัฐฯ">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-seam px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="module-label">STOCK DETAIL</span>
          <SessionBadge session={data.session} />
          <span className="text-[10px] text-text-muted">
            {sectorFilter
              ? `${model.tiles.length} หุ้นในกลุ่ม${sectorLabel(sectorFilter)}`
              : `${model.tiles.length} หุ้นใหญ่ · ตัวอย่าง`}
          </span>
          {sectorFilter && onClearSector && (
            <button
              type="button"
              onClick={onClearSector}
              className="rounded-sm px-1 py-0.5 text-[10px] text-ch-price transition-colors hover:bg-ch-price-dim/40"
            >
              ดูทุกกลุ่ม
            </button>
          )}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-2">
          <HeatmapLegend
            scaleMax={model.scaleMax}
            title="สีเขียว = ราคาสูงขึ้น · สีแดง = ราคาลดลง เทียบราคาปิดก่อนหน้า"
          />
          <span className="telemetry text-[10px] text-text-muted">
            {asOfLabel ? `อัปเดต ${asOfLabel}` : "—"}
          </span>
          {stale && <span className="text-[10px] text-down">อัปเดตไม่สำเร็จ</span>}
          <button
            type="button"
            onClick={() => void load("manual")}
            disabled={refreshing}
            aria-label="รีเฟรชข้อมูลตลาด"
            className="rounded p-1 text-text-muted transition-colors hover:text-text-primary disabled:opacity-50"
          >
            <IconRefresh
              className={`h-3.5 w-3.5 ${refreshing ? "animate-spin motion-reduce:animate-none" : ""}`}
            />
          </button>
        </div>
      </div>

      <Readout
        model={model}
        tile={hoveredTile}
        scopeLabel={sectorFilter ? `กลุ่ม${sectorLabel(sectorFilter)}` : null}
      />

      <div className="p-1.5 sm:p-2">
        <div className="hidden lg:block">
          <MarketTreemap
            sectors={model.sectors}
            scaleMax={model.scaleMax}
            onHover={setHovered}
          />
        </div>
        <div className="lg:hidden">
          <MobileMarketHeatmap
            sectors={model.sectors}
            scaleMax={model.scaleMax}
            onHover={setHovered}
          />
        </div>
      </div>

      <HeatmapFooter data={data} model={model} />
    </section>
  );
}
