"use client";

import { useEffect, useState } from "react";
import type { AnalysisRead } from "@/lib/analysis";

const VERDICT_TH: Record<AnalysisRead["verdict"], { label: string; color: string }> = {
  bullish: { label: "เอนไปทางขาขึ้น", color: "var(--up)" },
  bearish: { label: "เอนไปทางขาลง", color: "var(--down)" },
  neutral: { label: "เป็นกลาง", color: "var(--text-secondary)" },
  mixed: { label: "สัญญาณผสม", color: "var(--ch-price)" },
};

export function AnalysisPanel() {
  const [read, setRead] = useState<AnalysisRead | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "no_key">("loading");

  useEffect(() => {
    fetch("/api/analysis")
      .then((r) => r.json())
      .then((data) => {
        if (data.error === "MISSING_API_KEY") return setStatus("no_key");
        if (data.error || !data.read) return setStatus("error");
        setRead(data.read);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  return (
    <div className="module p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="module-label">บทวิเคราะห์สังเคราะห์ (Rule-based)</div>
        {status === "ready" && read && (
          <span
            className="telemetry text-[11px] rounded px-2 py-0.5"
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
            <div className="telemetry text-[10px] text-ch-rsi mb-1.5">ด้านเทคนิค</div>
            <ul className="flex flex-col gap-1.5">
              {read.technical.map((line, i) => (
                <li key={i} className="text-xs text-text-secondary leading-relaxed pl-3 relative before:content-['·'] before:absolute before:left-0 before:text-ch-rsi">
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="telemetry text-[10px] text-ch-macd mb-1.5">ด้านปัจจัยพื้นฐาน</div>
            <ul className="flex flex-col gap-1.5">
              {read.fundamental.map((line, i) => (
                <li key={i} className="text-xs text-text-secondary leading-relaxed pl-3 relative before:content-['·'] before:absolute before:left-0 before:text-ch-macd">
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-[10px] text-text-muted border-t border-seam pt-2">
            บทวิเคราะห์นี้สร้างจากกฎที่ตั้งไว้ล่วงหน้า ไม่ใช่คำแนะนำการลงทุน โปรดใช้ประกอบการตัดสินใจของคุณเอง
          </p>
        </div>
      )}
    </div>
  );
}
