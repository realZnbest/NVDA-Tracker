"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { changeColor, formatMarketCap, formatPercent, formatPrice } from "@/lib/heatmap-format";
import {
  buildMarketHeatmapModel,
  type MarketGroupBy,
  type MarketHeatmapModel,
  type WeightedMarketTile,
} from "@/lib/market-heatmap-model";
import type { MarketHeatmapResponse } from "@/lib/types";
import { usePoll } from "@/lib/use-poll";
import { MarketHeatmapLegend } from "./market-heatmap-legend";
import { MarketHeatmapMobile, MarketHeatmapWall } from "./market-heatmap-wall";
import { SessionBadge } from "./session-badge";
import {
  IconArrowDown,
  IconArrowUp,
  IconChevronDown,
  IconCollapse,
  IconExpand,
  IconGrid,
  IconRefresh,
} from "./icons";

const LIVE_REFRESH_MS = 60_000;
const CLOSED_REFRESH_MS = 5 * 60_000;
/** Phone board: one near-square canvas so the whole index fits the screen the way the
 *  TradingView board does; the viewport width is the real cap, this is the fallback. */
const MOBILE_MAP_SIZE = 360;

function MarketReadout({
  model,
  tile,
}: {
  model: MarketHeatmapModel;
  tile: WeightedMarketTile | null;
}) {
  return (
    <div className="flex min-h-[36px] flex-wrap items-center gap-x-3 gap-y-1 border-b border-seam/60 px-3 py-1.5 sm:px-4">
      {tile ? (
        <>
          <span className="text-xs font-medium text-text-primary">{tile.symbol}</span>
          <span className="hidden max-w-[240px] truncate text-[11px] text-text-muted sm:inline">
            {tile.name}
          </span>
          <span className="telemetry text-[11px] text-text-primary">
            {formatPrice(tile.price)}{" "}
            <span className="text-text-muted">USD</span>
          </span>
          <span
            className="telemetry text-[11px] font-medium"
            style={{ color: changeColor(tile.changePercent) }}
          >
            {formatPercent(tile.changePercent)}
          </span>
          <span className="text-[11px] text-text-muted">
            มูลค่าตลาด{" "}
            <span className="telemetry text-text-secondary">
              {formatMarketCap(tile.marketCap)}
            </span>
          </span>
          <span className="ml-auto hidden shrink-0 text-[10px] text-text-muted lg:inline">
            {tile.sector} · {tile.industry}
          </span>
        </>
      ) : (
        <>
          <span className="text-[11px] text-text-secondary">
            ภาพรวม {model.tiles.length} หุ้น
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-text-muted">
            <IconArrowUp className="h-3 w-3 text-up" />
            ขึ้น <span className="telemetry text-up">{model.advancers}</span>
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-text-muted">
            <IconArrowDown className="h-3 w-3 text-down" />
            ลง <span className="telemetry text-down">{model.decliners}</span>
          </span>
          {model.flat > 0 ? (
            <span className="text-[11px] text-text-muted">
              ทรงตัว{" "}
              <span className="telemetry text-text-secondary">{model.flat}</span>
            </span>
          ) : null}
          {model.unknown > 0 ? (
            <span className="text-[11px] text-text-muted">
              ไม่มีข้อมูล{" "}
              <span className="telemetry text-text-secondary">{model.unknown}</span>
            </span>
          ) : null}
          <span
            className="text-[11px] text-text-muted"
            title="เฉลี่ยถ่วงน้ำหนักด้วยมูลค่าตลาดของหุ้นที่แสดงบนแผนที่"
          >
            ตลาดโดยรวม{" "}
            <span
              className="telemetry text-xs font-medium"
              style={{ color: changeColor(model.weightedChange) }}
            >
              {formatPercent(model.weightedChange)}
            </span>
          </span>
          {model.leader ? (
            <span className="hidden text-[10px] text-text-muted lg:inline">
              นำ{" "}
              <span className="telemetry text-text-secondary">{model.leader.symbol}</span>{" "}
              <span style={{ color: changeColor(model.leader.changePercent) }}>
                {formatPercent(model.leader.changePercent)}
              </span>
            </span>
          ) : null}
          {model.laggard ? (
            <span className="hidden text-[10px] text-text-muted lg:inline">
              ร่วง{" "}
              <span className="telemetry text-text-secondary">{model.laggard.symbol}</span>{" "}
              <span style={{ color: changeColor(model.laggard.changePercent) }}>
                {formatPercent(model.laggard.changePercent)}
              </span>
            </span>
          ) : null}
        </>
      )}
    </div>
  );
}

function MarketHeatmapSkeleton() {
  return (
    <section
      className="module overflow-hidden"
      aria-busy="true"
      aria-label="กำลังโหลดฮีตแมป S&P 500"
    >
      <div className="flex items-center gap-3 border-b border-seam px-3 py-3 sm:px-4">
        <span className="h-3 w-24 animate-pulse rounded bg-panel-2" />
        <span className="h-3 w-14 animate-pulse rounded bg-panel-2" />
        <span className="ml-auto h-3 w-32 animate-pulse rounded bg-panel-2" />
      </div>
      <div className="p-2">
        <div className="h-[clamp(520px,calc(100dvh-20rem),900px)] animate-pulse rounded bg-panel-2/60" />
      </div>
    </section>
  );
}

function MarketHeatmapError({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <section className="module overflow-hidden" aria-label="โหลดฮีตแมปไม่สำเร็จ">
      <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <p className="text-sm text-text-primary">ดึงข้อมูล S&amp;P 500 ไม่สำเร็จ</p>
        <p className="max-w-sm text-[11px] text-text-muted">
          {error === "HEATMAP_UNAVAILABLE"
            ? "แหล่งข้อมูล TradingView ไม่ตอบสนองในขณะนี้"
            : "ตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง"}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-sm border border-seam bg-panel-2 px-3 py-1.5 text-[11px] text-text-secondary transition-colors hover:text-text-primary"
        >
          <IconRefresh className="h-3.5 w-3.5" />
          ลองอีกครั้ง
        </button>
      </div>
    </section>
  );
}

export function MarketHeatmapView() {
  const [data, setData] = useState<MarketHeatmapResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [stale, setStale] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<MarketGroupBy>("sector");
  const [fullscreen, setFullscreen] = useState(false);
  const hasData = useRef(false);
  const containerRef = useRef<HTMLElement | null>(null);

  const load = useCallback(async (mode: "initial" | "manual" | "poll" = "initial") => {
    if (mode !== "poll") setRefreshing(true);
    try {
      const res = await fetch("/api/heatmap/market", { cache: "no-store" });
      const payload = (await res.json().catch(() => null)) as
        | (MarketHeatmapResponse & { error?: string })
        | null;

      if (!res.ok || !payload || !Array.isArray(payload.tiles) || payload.tiles.length === 0) {
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

  const refreshMs = data?.session === "closed" ? CLOSED_REFRESH_MS : LIVE_REFRESH_MS;
  usePoll(() => void load("poll"), refreshMs, {
    enabled: data !== null,
    leading: false,
  });

  useEffect(() => {
    const onFullscreenChange = () => {
      setFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const element = containerRef.current;
    if (!element) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await element.requestFullscreen();
    } catch {
      // Browsers can refuse fullscreen when the gesture is not trusted; the board still works.
    }
  }, []);

  const model = useMemo(
    () => (data ? buildMarketHeatmapModel(data.tiles, groupBy) : null),
    [data, groupBy]
  );
  const hoveredTile = hovered
    ? (model?.tiles.find((tile) => tile.symbol === hovered) ?? null)
    : null;
  const asOfLabel = data
    ? new Date(data.asOf).toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  const dataTimeLabel = data?.dataTime
    ? new Date(data.dataTime).toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  const delayedLabel = data?.delayedMinutes
    ? `ล่าช้า ~${data.delayedMinutes} นาที`
    : "ข้อมูลจาก TradingView";

  if (!data && status === "loading") return <MarketHeatmapSkeleton />;
  if (!data && status === "error") {
    return <MarketHeatmapError error={error} onRetry={() => void load("initial")} />;
  }
  if (!data || !model) return null;

  const minSectorShare = groupBy === "industry" ? 0.001 : 0.006;

  return (
    <section
      ref={containerRef}
      className={
        fullscreen
          ? "flex h-dvh flex-col overflow-hidden bg-bg"
          : "module overflow-hidden"
      }
      aria-label="ฮีตแมป S&P 500 ตลาดหุ้นสหรัฐฯ"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-seam px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="module-label">S&amp;P 500 INDEX</span>
          <SessionBadge session={data.session} />
          <span className="text-[10px] text-text-muted">{model.tiles.length} หุ้น</span>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <span className="hidden items-center gap-1 rounded-sm border border-seam bg-panel-2 px-2 py-1 text-[10px] text-text-muted sm:inline-flex">
            <IconGrid className="h-3 w-3" />
            Market cap
          </span>
          <span className="hidden items-center gap-1 rounded-sm border border-seam bg-panel-2 px-2 py-1 text-[10px] text-text-muted sm:inline-flex">
            <span aria-hidden="true" className="grid grid-cols-2 gap-[2px]">
              <span className="h-1.5 w-1.5 rounded-[1px] bg-down" />
              <span className="h-1.5 w-1.5 rounded-[1px] bg-up" />
            </span>
            Change 1D, %
          </span>
          <label className="relative inline-flex items-center rounded-sm border border-seam bg-panel-2">
            <span className="sr-only">จัดกลุ่มแผนที่</span>
            <select
              value={groupBy}
              onChange={(event) => setGroupBy(event.target.value as MarketGroupBy)}
              style={{ colorScheme: "dark" }}
              className="appearance-none bg-transparent py-1 pl-2 pr-6 text-[10px] text-text-secondary outline-none"
            >
              <option value="sector">Sector</option>
              <option value="industry">Industry</option>
            </select>
            <IconChevronDown className="pointer-events-none absolute right-1.5 h-3 w-3 text-text-muted" />
          </label>
          <span className="telemetry hidden text-[10px] text-text-muted sm:inline">
            {asOfLabel ? `อัปเดต ${asOfLabel}` : "—"}
          </span>
          {stale ? <span className="text-[10px] text-down">อัปเดตไม่สำเร็จ</span> : null}
          <button
            type="button"
            onClick={() => void load("manual")}
            disabled={refreshing}
            aria-label="รีเฟรชฮีตแมป S&P 500"
            className="rounded p-1 text-text-muted transition-colors hover:text-text-primary disabled:opacity-50"
          >
            <IconRefresh
              className={`h-3.5 w-3.5 ${refreshing ? "animate-spin motion-reduce:animate-none" : ""}`}
            />
          </button>
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            aria-label={fullscreen ? "ออกจากเต็มจอ" : "ขยายเต็มจอ"}
            className="hidden rounded p-1 text-text-muted transition-colors hover:text-text-primary sm:inline-flex"
          >
            {fullscreen ? (
              <IconCollapse className="h-3.5 w-3.5" />
            ) : (
              <IconExpand className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      <MarketReadout model={model} tile={hoveredTile} />

      <div className={fullscreen ? "min-h-0 flex-1 p-1.5 sm:p-2" : "p-1.5 sm:p-2"}>
        <div className="hidden h-full md:block">
          <MarketHeatmapWall
            sectors={model.sectors}
            minSectorShare={minSectorShare}
            fullscreen={fullscreen}
            onHover={setHovered}
          />
        </div>
        <div className="md:hidden">
          <MarketHeatmapMobile sectors={model.sectors} size={MOBILE_MAP_SIZE} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-seam/70 px-3 py-2 sm:px-4">
        <MarketHeatmapLegend />
        <span className="text-[9px] text-text-muted">
          ขนาด = มูลค่าตลาด · สี = % เปลี่ยนแปลง 1 วัน (สูงสุด ±3%)
        </span>
        <span className="ml-auto text-[9px] text-text-muted">
          {dataTimeLabel ? `ข้อมูล ณ ${dataTimeLabel} · ` : ""}
          {delayedLabel} · โลโก้จาก TradingView
        </span>
      </div>
    </section>
  );
}
