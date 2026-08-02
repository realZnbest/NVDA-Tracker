"use client";

import { useEffect, useState } from "react";
import type { FinnhubRecommendationTrend } from "@/lib/finnhub";

interface AnalystResponse {
  trends: FinnhubRecommendationTrend[];
}

/** Weighted from -2 (all strong sell) to +2 (all strong buy), mapped to a Thai label. */
function consensusFromTrend(trend: FinnhubRecommendationTrend): { label: string; color: string } {
  const total = trend.strongBuy + trend.buy + trend.hold + trend.sell + trend.strongSell;
  if (total === 0) return { label: "ไม่มีข้อมูล", color: "var(--text-muted)" };
  const score =
    (trend.strongBuy * 2 + trend.buy * 1 + trend.sell * -1 + trend.strongSell * -2) / total;
  if (score >= 1.5) return { label: "ซื้อทันที", color: "var(--up)" };
  if (score >= 0.5) return { label: "ซื้อ", color: "var(--up)" };
  if (score >= -0.5) return { label: "ถือ", color: "var(--ch-price)" };
  if (score >= -1.5) return { label: "ขาย", color: "var(--down)" };
  return { label: "ขายทันที", color: "var(--down)" };
}

export function AnalystPanel({ symbol }: { symbol: string }) {
  const [data, setData] = useState<AnalystResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "no_key" | "no_data">(
    "loading"
  );

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset status when the symbol changes
    setStatus("loading");
    fetch(`/api/analyst?symbol=${symbol}`)
      .then((r) => r.json())
      .then((analyst) => {
        if (cancelled) return;
        if (analyst.error === "MISSING_API_KEY") return setStatus("no_key");
        if (analyst.error === "NO_DATA" || !analyst.trends || analyst.trends.length === 0) {
          return setStatus("no_data");
        }
        setData(analyst);
        setStatus("ready");
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  return (
    <div className="module p-4">
      <div className="module-label mb-3">บทวิเคราะห์นักวิเคราะห์ (Wall Street)</div>

      {status === "loading" && <p className="text-xs text-text-muted">กำลังโหลด…</p>}
      {status === "no_key" && (
        <p className="text-xs text-text-muted">ต้องตั้งค่า FINNHUB_API_KEY ก่อนจึงจะดึงข้อมูลนี้ได้</p>
      )}
      {status === "no_data" && (
        <p className="text-xs text-text-muted">ยังไม่มีข้อมูลบทวิเคราะห์นักวิเคราะห์ในตอนนี้</p>
      )}
      {status === "error" && <p className="text-xs text-text-muted">โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชอีกครั้ง</p>}

      {status === "ready" && data && <RatingBreakdown trend={data.trends[data.trends.length - 1]} />}
    </div>
  );
}

function RatingBreakdown({ trend }: { trend: FinnhubRecommendationTrend }) {
  const segments: { key: string; count: number; color: string; label: string }[] = [
    { key: "strongBuy", count: trend.strongBuy, color: "var(--up)", label: "ซื้อทันที" },
    { key: "buy", count: trend.buy, color: "#7fd99a", label: "ซื้อ" },
    { key: "hold", count: trend.hold, color: "var(--text-muted)", label: "ถือ" },
    { key: "sell", count: trend.sell, color: "#e08a8a", label: "ขาย" },
    { key: "strongSell", count: trend.strongSell, color: "var(--down)", label: "ขายทันที" },
  ];
  const total = segments.reduce((sum, s) => sum + s.count, 0);
  const consensus = consensusFromTrend(trend);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span
          className="telemetry text-xs rounded px-2 py-0.5"
          style={{ color: consensus.color, background: "rgba(255,255,255,0.04)" }}
        >
          {consensus.label}
        </span>
        <span className="telemetry text-[10px] text-text-muted">จาก {total} นักวิเคราะห์</span>
      </div>

      {total > 0 && (
        <div className="flex h-2 rounded-full overflow-hidden">
          {segments.map((s) =>
            s.count > 0 ? (
              <div key={s.key} style={{ width: `${(s.count / total) * 100}%`, background: s.color }} />
            ) : null
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {segments.map((s) => (
          <span key={s.key} className="flex items-center gap-1 telemetry text-[10px] text-text-secondary">
            <span className="h-1.5 w-1.5 rounded-sm" style={{ background: s.color }} />
            {s.label} {s.count}
          </span>
        ))}
      </div>
    </div>
  );
}
