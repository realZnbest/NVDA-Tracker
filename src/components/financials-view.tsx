"use client";

import { useEffect, useState } from "react";
import { extractAllQuarters, type QuarterMetrics } from "@/lib/financial-metrics";
import { TrendBars } from "./trend-bars";
import type { FinnhubReportedFinancials } from "@/lib/finnhub";

type Metrics = Record<string, number | undefined>;

const fmtUsd = (v: number) => {
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  return `$${v.toFixed(2)}`;
};
const fmtPct = (v: number) => `${v.toFixed(2)}%`;
const fmtEps = (v: number) => `$${v.toFixed(2)}`;

export function FinancialsView() {
  const [quarters, setQuarters] = useState<QuarterMetrics[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "no_key">("loading");

  useEffect(() => {
    fetch("/api/financials")
      .then((r) => r.json())
      .then((data) => {
        if (data.error === "MISSING_API_KEY") return setStatus("no_key");
        if (data.error || !data.reported) return setStatus("error");
        const reported = data.reported as FinnhubReportedFinancials;
        setQuarters(extractAllQuarters(reported).slice(-8));
        setMetrics(data.metrics ?? {});
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  if (status === "loading") return <p className="text-sm text-text-muted px-1">กำลังโหลดงบการเงิน…</p>;
  if (status === "no_key")
    return <p className="text-sm text-text-muted px-1">ต้องตั้งค่า FINNHUB_API_KEY ก่อนจึงจะดึงงบการเงินได้</p>;
  if (status === "error" || quarters.length === 0)
    return <p className="text-sm text-text-muted px-1">โหลดงบการเงินไม่สำเร็จ ลองรีเฟรชอีกครั้ง</p>;

  const revenueData = quarters.map((q) => ({ label: q.periodLabel, value: q.revenue }));
  const netIncomeData = quarters.map((q) => ({ label: q.periodLabel, value: q.netIncome }));
  const fcfData = quarters.map((q) => ({ label: q.periodLabel, value: q.freeCashFlow }));
  const marginData = quarters.map((q) => ({ label: q.periodLabel, value: q.netMargin }));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <RatioCard label="P/E (TTM)" value={metrics?.peNormalizedAnnual ?? metrics?.peTTM} suffix="เท่า" />
        <RatioCard label="P/S (TTM)" value={metrics?.psTTM} suffix="เท่า" />
        <RatioCard label="อัตรากำไรขั้นต้น" value={metrics?.grossMarginTTM} suffix="%" />
        <RatioCard label="อัตรากำไรสุทธิ" value={metrics?.netProfitMarginTTM} suffix="%" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="module p-3">
          <div className="module-label mb-2 text-ch-price">รายได้รายไตรมาส</div>
          <TrendBars data={revenueData} color="var(--ch-price)" formatValue={fmtUsd} />
        </div>
        <div className="module p-3">
          <div className="module-label mb-2 text-ch-macd">กำไรสุทธิรายไตรมาส</div>
          <TrendBars data={netIncomeData} color="var(--ch-macd)" formatValue={fmtUsd} />
        </div>
        <div className="module p-3">
          <div className="module-label mb-2 text-ch-volume">กระแสเงินสดอิสระ</div>
          <TrendBars data={fcfData} color="var(--ch-volume)" formatValue={fmtUsd} />
        </div>
        <div className="module p-3">
          <div className="module-label mb-2 text-ch-rsi">อัตรากำไรสุทธิ</div>
          <TrendBars data={marginData} color="var(--ch-rsi)" formatValue={fmtPct} />
        </div>
      </div>

      <div className="module overflow-x-auto scrollbar-thin p-1">
        <table className="w-full min-w-[720px] telemetry text-xs">
          <thead>
            <tr className="text-text-muted text-[10px] border-b border-seam">
              <th className="text-left font-normal py-2 px-3">งวด</th>
              <th className="text-right font-normal py-2 px-3">รายได้</th>
              <th className="text-right font-normal py-2 px-3">กำไรสุทธิ</th>
              <th className="text-right font-normal py-2 px-3">EPS</th>
              <th className="text-right font-normal py-2 px-3">อัตรากำไรขั้นต้น</th>
              <th className="text-right font-normal py-2 px-3">อัตรากำไรสุทธิ</th>
              <th className="text-right font-normal py-2 px-3">หนี้สินรวม</th>
              <th className="text-right font-normal py-2 px-3">กระแสเงินสดอิสระ</th>
            </tr>
          </thead>
          <tbody>
            {quarters
              .slice()
              .reverse()
              .map((q) => (
                <tr key={q.periodLabel} className="border-b border-seam/50 text-text-secondary">
                  <td className="py-2 px-3 text-text-primary">{q.periodLabel}</td>
                  <td className="text-right py-2 px-3">{q.revenue !== null ? fmtUsd(q.revenue) : "—"}</td>
                  <td className="text-right py-2 px-3">{q.netIncome !== null ? fmtUsd(q.netIncome) : "—"}</td>
                  <td className="text-right py-2 px-3">{q.eps !== null ? fmtEps(q.eps) : "—"}</td>
                  <td className="text-right py-2 px-3">{q.grossMargin !== null ? fmtPct(q.grossMargin) : "—"}</td>
                  <td className="text-right py-2 px-3">{q.netMargin !== null ? fmtPct(q.netMargin) : "—"}</td>
                  <td className="text-right py-2 px-3">{q.totalDebt !== null ? fmtUsd(q.totalDebt) : "—"}</td>
                  <td className="text-right py-2 px-3">{q.freeCashFlow !== null ? fmtUsd(q.freeCashFlow) : "—"}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RatioCard({ label, value, suffix }: { label: string; value?: number; suffix: string }) {
  return (
    <div className="module p-3">
      <div className="module-label mb-1.5">{label}</div>
      <div className="telemetry text-xl text-text-primary">
        {value !== undefined && value !== null ? value.toFixed(2) : "—"}
        <span className="text-xs text-text-muted ml-1">{suffix}</span>
      </div>
    </div>
  );
}
