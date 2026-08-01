"use client";

import { useEffect, useState } from "react";
import type { FinnhubRecommendationTrend } from "@/lib/finnhub";
import type { AnalystTargets } from "@/lib/yahoo";

interface AnalystResponse {
  trends: FinnhubRecommendationTrend[] | null;
  targets: AnalystTargets | null;
  targetsError: string | null;
}

const RATING_LABEL_TH: Record<string, { label: string; color: string }> = {
  strong_buy: { label: "ซื้อแรง", color: "var(--up)" },
  buy: { label: "ซื้อ", color: "var(--up)" },
  hold: { label: "ถือ", color: "var(--ch-price)" },
  underperform: { label: "ต่ำกว่าตลาด", color: "var(--down)" },
  sell: { label: "ขาย", color: "var(--down)" },
  strong_sell: { label: "ขายแรง", color: "var(--down)" },
};

export function AnalystPanel() {
  const [data, setData] = useState<AnalystResponse | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "no_key" | "no_data">(
    "loading"
  );

  useEffect(() => {
    Promise.all([
      fetch("/api/analyst").then((r) => r.json()),
      fetch("/api/quote").then((r) => r.json()),
    ])
      .then(([analyst, quote]) => {
        if (analyst.error === "MISSING_API_KEY") return setStatus("no_key");
        if (analyst.error === "NO_DATA" || (!analyst.trends && !analyst.targets)) {
          return setStatus("no_data");
        }
        setData(analyst);
        if (quote.quote?.c) setPrice(quote.quote.c);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

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

      {status === "ready" && data && (
        <div className="flex flex-col gap-4">
          {data.targets ? (
            <PriceTargetRange targets={data.targets} price={price} />
          ) : (
            <div className="text-xs text-text-muted">
              <p>ราคาเป้าหมายจาก Yahoo ดึงไม่สำเร็จตอนนี้ (อาจติดระบบกันบอทฝั่งเซิร์ฟเวอร์) ลองรีเฟรชอีกครั้งภายหลัง</p>
              {data.targetsError && (
                <p className="telemetry text-[10px] mt-1 opacity-60">รายละเอียด: {data.targetsError}</p>
              )}
            </div>
          )}
          {data.trends && data.trends.length > 0 && (
            <RatingBreakdown trend={data.trends[data.trends.length - 1]} />
          )}
        </div>
      )}
    </div>
  );
}

function PriceTargetRange({ targets, price }: { targets: AnalystTargets; price: number | null }) {
  const rating = targets.recommendationKey ? RATING_LABEL_TH[targets.recommendationKey] : null;
  const { targetLow, targetHigh, targetMean } = targets;

  const hasRange = targetLow !== null && targetHigh !== null && targetHigh > targetLow;
  const pct = (v: number) => ((v - (targetLow ?? 0)) / ((targetHigh ?? 1) - (targetLow ?? 0))) * 100;
  const upside =
    price !== null && targetMean !== null ? ((targetMean - price) / price) * 100 : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        {rating && (
          <span
            className="telemetry text-xs rounded px-2 py-0.5"
            style={{ color: rating.color, background: "rgba(255,255,255,0.04)" }}
          >
            {rating.label}
          </span>
        )}
        {targets.numberOfAnalysts !== null && (
          <span className="telemetry text-[10px] text-text-muted">
            จาก {targets.numberOfAnalysts} นักวิเคราะห์
          </span>
        )}
      </div>

      {targetMean !== null && (
        <div className="flex items-baseline gap-2 mb-2">
          <span className="telemetry text-lg text-text-primary">${targetMean.toFixed(2)}</span>
          <span className="text-[11px] text-text-muted">ราคาเป้าหมายเฉลี่ย</span>
          {upside !== null && (
            <span
              className="telemetry text-[11px] ml-auto"
              style={{ color: upside >= 0 ? "var(--up)" : "var(--down)" }}
            >
              {upside >= 0 ? "+" : ""}
              {upside.toFixed(1)}%
            </span>
          )}
        </div>
      )}

      {hasRange && (
        <div className="relative h-1.5 rounded-full bg-seam mt-3 mb-1">
          <div
            className="absolute inset-y-0 rounded-full"
            style={{ left: "0%", right: "0%", background: "var(--seam-bright)" }}
          />
          {targetMean !== null && (
            <div
              className="absolute -top-1 h-3.5 w-0.5 bg-ch-price"
              style={{ left: `${pct(targetMean)}%` }}
              title="เฉลี่ย"
            />
          )}
          {price !== null && targetLow !== null && targetHigh !== null && price >= targetLow && price <= targetHigh && (
            <div
              className="absolute -top-2 h-5 w-0.5 bg-text-primary"
              style={{ left: `${pct(price)}%` }}
              title="ราคาปัจจุบัน"
            />
          )}
        </div>
      )}
      {hasRange && (
        <div className="flex justify-between telemetry text-[10px] text-text-muted">
          <span>${targetLow?.toFixed(0)} ต่ำสุด</span>
          <span>${targetHigh?.toFixed(0)} สูงสุด</span>
        </div>
      )}
    </div>
  );
}

function RatingBreakdown({ trend }: { trend: FinnhubRecommendationTrend }) {
  const segments: { key: string; count: number; color: string; label: string }[] = [
    { key: "strongBuy", count: trend.strongBuy, color: "var(--up)", label: "ซื้อแรง" },
    { key: "buy", count: trend.buy, color: "#7fd99a", label: "ซื้อ" },
    { key: "hold", count: trend.hold, color: "var(--text-muted)", label: "ถือ" },
    { key: "sell", count: trend.sell, color: "#e08a8a", label: "ขาย" },
    { key: "strongSell", count: trend.strongSell, color: "var(--down)", label: "ขายแรง" },
  ];
  const total = segments.reduce((sum, s) => sum + s.count, 0);
  if (total === 0) return null;

  return (
    <div>
      <div className="flex h-2 rounded-full overflow-hidden">
        {segments.map((s) =>
          s.count > 0 ? (
            <div key={s.key} style={{ width: `${(s.count / total) * 100}%`, background: s.color }} />
          ) : null
        )}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
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
