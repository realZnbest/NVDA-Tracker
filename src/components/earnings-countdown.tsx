"use client";

import { useEffect, useState } from "react";
import type { FinnhubEarningsEvent } from "@/lib/finnhub";

const HOUR_LABEL_TH: Record<string, string> = {
  bmo: "ก่อนตลาดเปิด",
  amc: "หลังตลาดปิด",
  dmh: "ระหว่างตลาดเปิด",
};

function formatCountdown(targetDate: string, now: number): string {
  const target = new Date(`${targetDate}T00:00:00`).getTime();
  const diff = target - now;
  if (diff <= 0) return "วันนี้";
  const days = Math.floor(diff / (24 * 60 * 60_000));
  const hours = Math.floor((diff % (24 * 60 * 60_000)) / (60 * 60_000));
  if (days === 0) return `อีก ${hours} ชั่วโมง`;
  return `อีก ${days} วัน ${hours} ชั่วโมง`;
}

export function EarningsCountdown({ symbol }: { symbol: string }) {
  const [event, setEvent] = useState<FinnhubEarningsEvent | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "no_data" | "no_key" | "error">("loading");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetch(`/api/earnings?symbol=${symbol}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error === "MISSING_API_KEY") return setStatus("no_key");
        if (data.error) return setStatus("error");
        if (!data.event) return setStatus("no_data");
        setEvent(data.event);
        setStatus("ready");
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="module p-4">
      <div className="module-label mb-2 text-ch-price">รายงานผลประกอบการถัดไป</div>

      {status === "loading" && <p className="text-sm text-text-muted">กำลังโหลด…</p>}
      {status === "no_key" && (
        <p className="text-sm text-text-muted">ต้องตั้งค่า FINNHUB_API_KEY ก่อนจึงจะดูข้อมูลนี้ได้</p>
      )}
      {status === "error" && <p className="text-sm text-text-muted">โหลดข้อมูลไม่สำเร็จ</p>}
      {status === "no_data" && <p className="text-sm text-text-muted">ไม่มีข้อมูล</p>}

      {status === "ready" && event && (
        <div className="flex flex-col gap-1">
          <span className="telemetry text-2xl font-medium text-ch-price">
            {formatCountdown(event.date, now)}
          </span>
          <span className="telemetry text-xs text-text-secondary">
            {/* "-u-ca-gregory": plain "th-TH" defaults to the Buddhist era ("26 สิงหาคม 2569"),
                which this app deliberately doesn't show anywhere. Spelled out as explicit
                day/month/year rather than dateStyle:"long", which tacks a "ค.ศ." era
                marker onto the Gregorian year. */}
            {new Date(`${event.date}T00:00:00`).toLocaleDateString("th-TH-u-ca-gregory", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            {event.hour && HOUR_LABEL_TH[event.hour] && ` · ${HOUR_LABEL_TH[event.hour]}`}
          </span>
          {event.epsEstimate !== null && (
            <span className="telemetry text-[0.625rem] text-text-muted mt-1">
              คาด EPS {event.epsEstimate.toFixed(2)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
