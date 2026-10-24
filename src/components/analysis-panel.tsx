"use client";

import { useEffect, useState } from "react";
import type { AnalysisRead } from "@/lib/analysis";
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
          <div className="flex flex-col gap-2.5 border-b border-seam pb-3.5">
            <span className="text-sm font-medium" style={{ color: verdict.color }}>
              {verdict.label}
            </span>
            <VerdictScale verdict={read.verdict} label={verdict.label} color={verdict.color} />
            <p className="text-[12.5px] leading-relaxed text-text-secondary">{read.verdictText}</p>
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

/** Three annunciator lamps, bearish to bullish. A mixed read lights both outer lamps (the
 *  signals pull opposite ways); neutral lights only the middle one. */
function VerdictScale({
  verdict,
  label,
  color,
}: {
  verdict: AnalysisRead["verdict"];
  label: string;
  color: string;
}) {
  const lit = {
    bearish: [true, false, false],
    neutral: [false, true, false],
    bullish: [false, false, true],
    mixed: [true, false, true],
  }[verdict];
  const captions = ["ขาลง", "กลาง", "ขาขึ้น"];
  return (
    <div role="img" aria-label={`สัญญาณ: ${label}`} className="grid grid-cols-3 gap-1.5">
      {captions.map((caption, i) => (
        <div key={caption} className="flex flex-col gap-1">
          <span
            className="h-1.5 rounded-full"
            style={
              lit[i]
                ? { background: color }
                : { background: "var(--seam-bright)" }
            }
          />
          <span
            className="text-center text-[10px]"
            style={{ color: lit[i] ? color : "var(--text-secondary)" }}
          >
            {caption}
          </span>
        </div>
      ))}
    </div>
  );
}
