"use client";

import { useEffect, useState } from "react";
import type { AnalysisRead } from "@/lib/analysis";
import { usePersistentState } from "@/lib/use-persistent-state";
import { computeAggregatePosition, computePositionMetrics, type PositionLot } from "@/lib/position";
import { useAlertsContext } from "./alerts-provider";
import type { TimeframeKey } from "@/lib/timeframes";

const VERDICT_TH: Record<AnalysisRead["verdict"], { label: string; color: string }> = {
  bullish: { label: "เอนไปทางขาขึ้น", color: "var(--up)" },
  bearish: { label: "เอนไปทางขาลง", color: "var(--down)" },
  neutral: { label: "เป็นกลาง", color: "var(--text-secondary)" },
  mixed: { label: "สัญญาณผสม", color: "#e3a94b" },
};

interface PositionRead {
  shares: number;
  avgCost: number;
  pnl: number;
  pnlPercent: number;
}

export function AnalysisPanel({
  symbol = "NVDA",
  timeframe,
  embedded = false,
}: {
  symbol?: string;
  timeframe: TimeframeKey;
  embedded?: boolean;
}) {
  const { authStatus } = useAlertsContext();
  const [read, setRead] = useState<AnalysisRead | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "no_key">("loading");
  const [position, setPosition] = useState<PositionRead | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetch(`/api/analysis?tf=${timeframe}&symbol=${symbol}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error === "MISSING_API_KEY") return setStatus("no_key");
        if (data.error || !data.read) return setStatus("error");
        setRead(data.read);
        setStatus("ready");
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
    };
  }, [timeframe, symbol]);

  // Position data is private — only fetched/rendered for an authenticated owner session,
  // even though this panel itself renders on the public dashboard. Scoped to the symbol
  // being viewed — if the owner has no position in this symbol, the block stays null and
  // simply doesn't render, same graceful-absence pattern as an unauthenticated visitor.
  useEffect(() => {
    if (authStatus !== "authenticated") {
      setPosition(null);
      return;
    }
    let cancelled = false;
    Promise.all([
      fetch(`/api/position?symbol=${symbol}`).then((r) => r.json()),
      fetch(`/api/quote?symbol=${symbol}`).then((r) => r.json()),
    ])
      .then(([positionData, quoteData]) => {
        if (cancelled) return;
        const aggregate = computeAggregatePosition((positionData.lots ?? []) as PositionLot[]);
        if (!aggregate || !quoteData.quote) return setPosition(null);
        const metrics = computePositionMetrics(aggregate, quoteData.quote.c);
        setPosition({
          shares: aggregate.totalShares,
          avgCost: aggregate.avgCost,
          pnl: metrics.unrealizedPnl,
          pnlPercent: metrics.unrealizedPnlPercent,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authStatus, symbol]);

  const verdict = status === "ready" && read ? VERDICT_TH[read.verdict] : null;

  return (
    <div className={embedded ? "p-4" : "module p-4"}>
      {!embedded && (
        <div className="mb-3 flex items-center justify-between">
          <div className="module-label">บทวิเคราะห์สังเคราะห์ (Rule-based)</div>
          {verdict && (
            <span
              className="telemetry rounded-[2px] px-2 py-0.5 text-[10px]"
              style={{ color: verdict.color, background: "rgba(255,255,255,0.04)" }}
            >
              {verdict.label}
            </span>
          )}
        </div>
      )}

      {status === "loading" && (
        <div className="flex flex-col gap-3">
          <div className="h-[86px] animate-pulse rounded-[2px] bg-white/[0.04]" />
          <div className="space-y-1.5">
            <div className="h-2.5 w-2/3 animate-pulse rounded bg-white/[0.04]" />
            <div className="h-2.5 w-full animate-pulse rounded bg-white/[0.03]" />
            <div className="h-2.5 w-4/5 animate-pulse rounded bg-white/[0.03]" />
          </div>
          <div className="space-y-1.5">
            <div className="h-2.5 w-1/2 animate-pulse rounded bg-white/[0.04]" />
            <div className="h-2.5 w-full animate-pulse rounded bg-white/[0.03]" />
          </div>
        </div>
      )}
      {status === "no_key" && (
        <p className="text-[11px] leading-relaxed text-text-muted">
          ต้องตั้งค่า FINNHUB_API_KEY ก่อนจึงจะวิเคราะห์ได้
        </p>
      )}
      {status === "error" && (
        <p className="text-[11px] leading-relaxed text-text-muted">
          ประมวลผลบทวิเคราะห์ไม่สำเร็จ ลองรีเฟรชอีกครั้ง
        </p>
      )}

      {status === "ready" && read && verdict && (
        <div className="flex flex-col gap-3.5">
          <div
            className="rounded-[2px] border border-seam p-3"
            style={{ backgroundColor: `color-mix(in srgb, ${verdict.color} 7%, transparent)` }}
          >
            <div className="flex items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: verdict.color }}
              />
              <span className="text-[11px] font-medium" style={{ color: verdict.color }}>
                {verdict.label}
              </span>
            </div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-text-secondary">
              {read.verdictText}
            </p>
          </div>

          <ReadSection title="ด้านเทคนิค" color="var(--ch-rsi)" lines={read.technical} />
          <ReadSection
            title="ด้านปัจจัยพื้นฐาน"
            color="var(--ch-macd)"
            lines={read.fundamental}
          />

          {position && (
            <div className="rounded-[2px] border border-seam bg-panel-2/50 p-3">
              <div className="module-label mb-1.5">ด้านพอร์ตของคุณ</div>
              <p className="text-[11px] leading-relaxed text-text-secondary">
                ถือ{" "}
                <span className="telemetry text-text-primary">
                  {position.shares.toLocaleString()}
                </span>{" "}
                หุ้น · ต้นทุนเฉลี่ย{" "}
                <span className="telemetry text-text-primary">
                  ${position.avgCost.toFixed(2)}
                </span>
              </p>
              <p className="mt-1 flex items-baseline gap-1.5">
                <span className="text-[10px] text-text-muted">กำไร/ขาดทุน</span>
                <span
                  className="telemetry text-sm"
                  style={{
                    color: position.pnl >= 0 ? "var(--up)" : "var(--down)",
                  }}
                >
                  {position.pnlPercent >= 0 ? "+" : ""}
                  {position.pnlPercent.toFixed(2)}%
                </span>
                <span className="telemetry text-[10px] text-text-muted">
                  ({position.pnl >= 0 ? "+" : ""}${position.pnl.toFixed(2)})
                </span>
              </p>
              <PositionNote symbol={symbol} />
            </div>
          )}

          <p className="border-t border-seam pt-2 text-[10px] leading-relaxed text-text-muted">
            บทวิเคราะห์นี้สร้างจากกฎที่ตั้งไว้ล่วงหน้า ไม่ใช่คำแนะนำการลงทุน
            โปรดใช้ประกอบการตัดสินใจของคุณเอง
          </p>
        </div>
      )}
    </div>
  );
}

function ReadSection({
  title,
  color,
  lines,
}: {
  title: string;
  color: string;
  lines: string[];
}) {
  return (
    <section>
      <h3 className="module-label mb-1.5 flex items-center gap-1.5">
        <span className="h-1 w-1 rounded-full" style={{ background: color }} />
        {title}
      </h3>
      <ul className="flex flex-col gap-1.5">
        {lines.map((line, index) => (
          <li
            key={index}
            className="flex gap-2 text-[11.5px] leading-relaxed text-text-secondary"
          >
            <span
              className="mt-[7px] h-1 w-1 shrink-0 rounded-full"
              style={{ background: color, opacity: 0.65 }}
            />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Private per-symbol note, kept in this browser only (localStorage) — never sent to the server. */
function PositionNote({ symbol }: { symbol: string }) {
  const [note, setNote] = usePersistentState(`position-note:${symbol}`, "");
  return (
    <textarea
      value={note}
      onChange={(e) => setNote(e.target.value)}
      placeholder="โน้ตของฉัน (เก็บในเครื่องนี้เท่านั้น)"
      rows={2}
      className="mt-2 w-full resize-none rounded border border-seam bg-panel-2 px-2 py-1.5 text-[11px] text-text-primary placeholder:text-text-muted"
    />
  );
}
