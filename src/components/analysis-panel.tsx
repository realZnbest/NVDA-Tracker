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
  mixed: { label: "สัญญาณผสม", color: "var(--ch-price)" },
};

export function AnalysisPanel({ symbol = "NVDA", timeframe }: { symbol?: string; timeframe: TimeframeKey }) {
  const { authStatus } = useAlertsContext();
  const [read, setRead] = useState<AnalysisRead | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "no_key">("loading");
  const [positionLine, setPositionLine] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset status when the timeframe changes
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
  // being viewed — if the owner has no position in this symbol, the line stays null and
  // simply doesn't render, same graceful-absence pattern as an unauthenticated visitor.
  useEffect(() => {
    if (authStatus !== "authenticated") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear private data on logout
      setPositionLine(null);
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
        if (!aggregate || !quoteData.quote) return setPositionLine(null);
        const metrics = computePositionMetrics(aggregate, quoteData.quote.c);
        const sign = metrics.unrealizedPnl >= 0 ? "+" : "";
        setPositionLine(
          `คุณถือ ${aggregate.totalShares.toLocaleString()} หุ้น ต้นทุนเฉลี่ย $${aggregate.avgCost.toFixed(2)} → กำไร/ขาดทุนขณะนี้ ${sign}${metrics.unrealizedPnlPercent.toFixed(2)}% (${sign}$${metrics.unrealizedPnl.toFixed(2)})`
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authStatus, symbol]);

  return (
    <div className="module p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="module-label">บทวิเคราะห์สังเคราะห์ (Rule-based)</div>
        {status === "ready" && read && (
          <span
            className="telemetry text-[0.6875rem] rounded px-2 py-0.5"
            style={{
              color: VERDICT_TH[read.verdict].color,
              background: "rgba(255,255,255,0.04)",
            }}
          >
            {VERDICT_TH[read.verdict].label}
          </span>
        )}
      </div>

      {status === "loading" && <p className="text-xs text-text-muted">กำลังประมวลผล…</p>}
      {status === "no_key" && (
        <p className="text-xs text-text-muted">ต้องตั้งค่า FINNHUB_API_KEY ก่อนจึงจะวิเคราะห์ได้</p>
      )}
      {status === "error" && <p className="text-xs text-text-muted">ประมวลผลบทวิเคราะห์ไม่สำเร็จ</p>}

      {status === "ready" && read && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-secondary leading-relaxed">{read.verdictText}</p>

          <div>
            <div className="telemetry text-[0.625rem] text-ch-rsi mb-1.5">ด้านเทคนิค</div>
            <ul className="flex flex-col gap-1.5">
              {read.technical.map((line, i) => (
                <li key={i} className="text-xs text-text-secondary leading-relaxed pl-3 relative before:content-['·'] before:absolute before:left-0 before:text-ch-rsi">
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="telemetry text-[0.625rem] text-ch-macd mb-1.5">ด้านปัจจัยพื้นฐาน</div>
            <ul className="flex flex-col gap-1.5">
              {read.fundamental.map((line, i) => (
                <li key={i} className="text-xs text-text-secondary leading-relaxed pl-3 relative before:content-['·'] before:absolute before:left-0 before:text-ch-macd">
                  {line}
                </li>
              ))}
            </ul>
          </div>

          {positionLine && (
            <div>
              <div className="telemetry text-[0.625rem] mb-1.5" style={{ color: "#f2c879" }}>
                ด้านพอร์ตของคุณ
              </div>
              <ul className="flex flex-col gap-1.5">
                <li className="text-xs text-text-secondary leading-relaxed pl-3 relative before:content-['·'] before:absolute before:left-0 before:text-[#f2c879]">
                  {positionLine}
                </li>
              </ul>
            </div>
          )}

          <p className="text-[0.625rem] text-text-muted border-t border-seam pt-2">
            บทวิเคราะห์นี้สร้างจากกฎที่ตั้งไว้ล่วงหน้า ไม่ใช่คำแนะนำการลงทุน โปรดใช้ประกอบการตัดสินใจของคุณเอง
          </p>
        </div>
      )}
    </div>
  );
}
