"use client";

import { useEffect, useState } from "react";
import type { FinnhubRecommendationTrend } from "@/lib/finnhub";

interface PriceTargets {
  mean: number;
  high: number;
  low: number;
}

interface AnalystResponse {
  trends: FinnhubRecommendationTrend[];
  targets: PriceTargets | null;
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

export function AnalystPanel({
  symbol,
  embedded = false,
}: {
  symbol: string;
  embedded?: boolean;
}) {
  const [data, setData] = useState<AnalystResponse | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "no_key" | "no_data">(
    "loading"
  );

  useEffect(() => {
    let cancelled = false;
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

  useEffect(() => {
    let cancelled = false;
    setPrice(null);
    fetch(`/api/quote?symbol=${symbol}`)
      .then((r) => r.json())
      .then((q) => !cancelled && q.quote && setPrice(q.quote.c as number))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  return (
    <div className={embedded ? "p-4" : "module p-4"}>
      {!embedded && (
        <div className="module-label mb-3">บทวิเคราะห์นักวิเคราะห์ (Wall Street)</div>
      )}

      {status === "loading" && (
        <div className="flex flex-col gap-3">
          <div className="h-3 w-24 animate-pulse rounded bg-white/[0.04]" />
          <div className="h-7 w-20 animate-pulse rounded bg-white/[0.05]" />
          <div className="h-1.5 w-full animate-pulse rounded-full bg-white/[0.04]" />
          <div className="h-10 w-full animate-pulse rounded bg-white/[0.03]" />
        </div>
      )}
      {status === "no_key" && (
        <p className="text-[11px] leading-relaxed text-text-muted">
          ต้องตั้งค่า FINNHUB_API_KEY ก่อนจึงจะดึงข้อมูลนี้ได้
        </p>
      )}
      {status === "no_data" && (
        <p className="text-[11px] leading-relaxed text-text-muted">
          ยังไม่มีข้อมูลบทวิเคราะห์นักวิเคราะห์ในตอนนี้
        </p>
      )}
      {status === "error" && (
        <p className="text-[11px] leading-relaxed text-text-muted">
          โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชอีกครั้ง
        </p>
      )}

      {status === "ready" && data && (
        <RatingBreakdown
          trend={data.trends[data.trends.length - 1]}
          targets={data.targets}
          price={price}
        />
      )}
    </div>
  );
}

function RatingBreakdown({
  trend,
  targets,
  price,
}: {
  trend: FinnhubRecommendationTrend;
  targets: PriceTargets | null;
  price: number | null;
}) {
  const segments: { key: string; count: number; color: string; label: string }[] = [
    { key: "strongBuy", count: trend.strongBuy, color: "var(--up)", label: "ซื้อทันที" },
    { key: "buy", count: trend.buy, color: "#7fd99a", label: "ซื้อ" },
    { key: "hold", count: trend.hold, color: "var(--text-muted)", label: "ถือ" },
    { key: "sell", count: trend.sell, color: "#e08a8a", label: "ขาย" },
    { key: "strongSell", count: trend.strongSell, color: "var(--down)", label: "ขายทันที" },
  ];
  const total = segments.reduce((sum, segment) => sum + segment.count, 0);
  const consensus = consensusFromTrend(trend);
  const periodLabel = formatPeriod(trend.period);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="module-label">มุมมองนักวิเคราะห์</div>
        <div className="mt-1 flex flex-wrap items-baseline gap-2">
          <span className="text-xl font-medium" style={{ color: consensus.color }}>
            {consensus.label}
          </span>
          <span className="telemetry text-[10px] text-text-muted">
            จาก {total} นักวิเคราะห์
          </span>
        </div>
      </div>

      {total > 0 && (
        <div className="flex h-1.5 overflow-hidden rounded-full bg-panel-2">
          {segments.map((segment) =>
            segment.count > 0 ? (
              <div
                key={segment.key}
                style={{
                  width: `${(segment.count / total) * 100}%`,
                  background: segment.color,
                }}
              />
            ) : null
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {segments.map((segment) => (
          <span
            key={segment.key}
            className="flex items-center justify-between gap-2 border-b border-seam/40 pb-1 text-[11px] text-text-secondary"
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-[1px]"
                style={{ background: segment.color }}
              />
              <span className="truncate">{segment.label}</span>
            </span>
            <span className="telemetry text-text-primary">{segment.count}</span>
          </span>
        ))}
      </div>

      {targets && <PriceTargetRows targets={targets} price={price} />}

      <p className="text-[10px] leading-relaxed text-text-muted">
        ข้อมูลจากบทวิเคราะห์ล่าสุด
        {periodLabel ? ` · ${periodLabel}` : ""}
      </p>
    </div>
  );
}

function PriceTargetRows({ targets, price }: { targets: PriceTargets; price: number | null }) {
  const rows = [
    { key: "mean", label: "เป้าเฉลี่ย", value: targets.mean },
    { key: "high", label: "เป้าสูงสุด", value: targets.high },
    { key: "low", label: "เป้าต่ำสุด", value: targets.low },
  ];
  return (
    <div className="flex flex-col gap-1.5">
      <div className="module-label">ราคาเป้าหมาย</div>
      {rows.map((row) => {
        const upside = price ? ((row.value - price) / price) * 100 : null;
        return (
          <span
            key={row.key}
            className="flex items-center justify-between gap-2 border-b border-seam/40 pb-1 text-[11px] text-text-secondary"
          >
            <span>{row.label}</span>
            <span className="flex items-baseline gap-2">
              <span className="telemetry text-text-primary">${row.value.toFixed(2)}</span>
              {upside !== null && (
                <span
                  className="telemetry w-14 text-right text-[10px]"
                  style={{ color: upside >= 0 ? "var(--up)" : "var(--down)" }}
                >
                  {upside >= 0 ? "+" : ""}
                  {upside.toFixed(1)}%
                </span>
              )}
            </span>
          </span>
        );
      })}
    </div>
  );
}

function formatPeriod(period: string): string | null {
  const date = new Date(`${period}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("th-TH-u-ca-gregory", {
    month: "long",
    year: "numeric",
  });
}
