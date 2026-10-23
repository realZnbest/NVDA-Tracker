"use client";

import { useEffect, useState } from "react";
import type { FinnhubEarningsEvent } from "@/lib/finnhub";
import { IconCalendar } from "./icons";

const HOUR_LABEL_TH: Record<string, string> = {
  bmo: "ก่อนตลาดเปิด",
  amc: "หลังตลาดปิด",
  dmh: "ระหว่างตลาดเปิด",
};

const DAY_MS = 24 * 60 * 60_000;

function countdownParts(targetDate: string, now: number): {
  today: boolean;
  days: number;
  hours: number;
} {
  const target = new Date(`${targetDate}T00:00:00`).getTime();
  const diff = target - now;
  if (diff <= 0) return { today: true, days: 0, hours: 0 };
  return {
    today: false,
    days: Math.floor(diff / DAY_MS),
    hours: Math.floor((diff % DAY_MS) / (60 * 60_000)),
  };
}

export function EarningsCountdown({
  symbol,
  embedded = false,
}: {
  symbol: string;
  embedded?: boolean;
}) {
  const [event, setEvent] = useState<FinnhubEarningsEvent | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "no_data" | "no_key" | "error">(
    "loading"
  );
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

  const countdown = event ? countdownParts(event.date, now) : null;

  return (
    <div className={embedded ? "p-4" : "module p-4"}>
      <div className="module-label mb-2.5 flex items-center gap-1.5 text-ch-price">
        <IconCalendar className="h-3 w-3" />
        รายงานผลประกอบการถัดไป
      </div>

      {status === "loading" && (
        <div className="flex flex-col gap-2">
          <div className="h-8 w-36 animate-pulse rounded bg-white/[0.05]" />
          <div className="h-2.5 w-48 animate-pulse rounded bg-white/[0.03]" />
          <div className="h-2.5 w-24 animate-pulse rounded bg-white/[0.03]" />
        </div>
      )}
      {status === "no_key" && (
        <p className="text-[11px] leading-relaxed text-text-muted">
          ต้องตั้งค่า FINNHUB_API_KEY ก่อนจึงจะดูข้อมูลนี้ได้
        </p>
      )}
      {status === "error" && (
        <p className="text-[11px] leading-relaxed text-text-muted">
          โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชอีกครั้ง
        </p>
      )}
      {status === "no_data" && (
        <p className="text-[11px] leading-relaxed text-text-muted">
          ยังไม่มีกำหนดการรายงานผลประกอบการในตอนนี้
        </p>
      )}

      {status === "ready" && event && countdown && (
        <div className="flex flex-col gap-2">
          {countdown.today ? (
            <span className="telemetry text-[2rem] leading-none text-ch-price">วันนี้</span>
          ) : (
            <div className="flex items-end gap-3">
              {countdown.days > 0 && (
                <div className="flex items-baseline gap-1">
                  <span className="telemetry text-[2rem] leading-none text-ch-price">
                    {countdown.days}
                  </span>
                  <span className="text-[11px] text-text-secondary">วัน</span>
                </div>
              )}
              <div className="flex items-baseline gap-1">
                <span
                  className={`telemetry leading-none ${
                    countdown.days > 0
                      ? "text-[1.5rem] text-text-primary"
                      : "text-[2rem] text-ch-price"
                  }`}
                >
                  {countdown.hours}
                </span>
                <span className="text-[11px] text-text-secondary">ชั่วโมง</span>
              </div>
            </div>
          )}

          <p className="text-[11px] leading-relaxed text-text-secondary">
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
          </p>

          {event.epsEstimate !== null && (
            <div className="mt-1 flex items-center justify-between border-t border-seam pt-2">
              <span className="text-[10px] text-text-muted">EPS คาดการณ์</span>
              <span className="telemetry text-[11px] text-text-primary">
                ${event.epsEstimate.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
