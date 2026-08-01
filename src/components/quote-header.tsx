"use client";

import { useEffect, useState } from "react";
import { IconArrowDown, IconArrowUp } from "./icons";
import { NotificationBell } from "./notification-bell";
import type { FinnhubQuote } from "@/lib/finnhub";
import type { ExtendedHoursQuote } from "@/lib/yahoo";

const SESSION_LABEL_TH: Record<ExtendedHoursQuote["session"], string> = {
  pre: "ก่อนตลาดเปิด",
  regular: "ระหว่างตลาดเปิด",
  post: "หลังตลาดปิด",
  closed: "ตลาดปิด",
};

export function QuoteHeader() {
  const [quote, setQuote] = useState<FinnhubQuote | null>(null);
  const [extended, setExtended] = useState<ExtendedHoursQuote | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "no_key">("loading");

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch("/api/quote")
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return;
          if (data.error === "MISSING_API_KEY") return setStatus("no_key");
          if (data.error || !data.quote) return setStatus("error");
          setQuote(data.quote);
          setExtended(data.extended ?? null);
          setStatus("ready");
        })
        .catch(() => !cancelled && setStatus("error"));
    };
    load();
    const id = setInterval(load, 20_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const up = quote ? quote.d >= 0 : true;
  const priceColor = up ? "var(--up)" : "var(--down)";

  return (
    <div className="module flex flex-wrap items-end justify-between gap-4 px-5 py-4">
      <div>
        <div className="flex flex-nowrap items-center gap-2 sm:gap-2.5 mb-2">
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-text-primary whitespace-nowrap">
            NVIDIA CORPORATION
          </h1>
          <span className="telemetry rounded px-2 py-0.5 text-[11px] bg-ch-price-dim text-ch-price whitespace-nowrap">
            NASDAQ · NVDA
          </span>
          <NotificationBell className="sm:hidden" />
        </div>

        {status === "ready" && quote ? (
          <>
            <div className="flex items-baseline gap-3">
              <span
                className="telemetry text-4xl font-medium transition-colors"
                style={{ color: priceColor }}
              >
                ${quote.c.toFixed(2)}
              </span>
              <span
                className="flex items-center gap-1 telemetry text-sm"
                style={{ color: priceColor }}
              >
                {up ? <IconArrowUp className="h-3.5 w-3.5" /> : <IconArrowDown className="h-3.5 w-3.5" />}
                {Math.abs(quote.d).toFixed(2)} ({quote.dp.toFixed(2)}%)
              </span>
            </div>

            <p className="telemetry text-[10px] text-text-muted mt-1">
              ข้อมูล ณ {new Date(quote.t * 1000).toLocaleString("th-TH", {
                dateStyle: "medium",
                timeStyle: "medium",
              })}
            </p>

            {extended && (extended.pre || extended.post) && (
              <div className="flex flex-wrap gap-4 mt-2">
                {extended.pre && (
                  <ExtendedRow label={SESSION_LABEL_TH.pre} data={extended.pre} />
                )}
                {extended.post && (
                  <ExtendedRow label={SESSION_LABEL_TH.post} data={extended.post} />
                )}
              </div>
            )}
          </>
        ) : status === "no_key" ? (
          <p className="text-sm text-text-muted">
            ยังไม่ได้ตั้งค่า FINNHUB_API_KEY — ใส่คีย์ใน .env.local แล้วรีสตาร์ทเซิร์ฟเวอร์
          </p>
        ) : status === "error" ? (
          <p className="text-sm text-text-muted">โหลดราคาล่าสุดไม่สำเร็จ</p>
        ) : (
          <span className="telemetry text-4xl font-medium text-text-muted">— . — —</span>
        )}
      </div>

      {status === "ready" && quote && (
        <div className="flex gap-6 telemetry text-xs text-text-secondary">
          <Stat label="เปิด" value={quote.o.toFixed(2)} />
          <Stat label="สูงสุด" value={quote.h.toFixed(2)} />
          <Stat label="ต่ำสุด" value={quote.l.toFixed(2)} />
          <Stat label="ปิดก่อนหน้า" value={quote.pc.toFixed(2)} />
        </div>
      )}
    </div>
  );
}

function ExtendedRow({
  label,
  data,
}: {
  label: string;
  data: { price: number; change: number; changePercent: number };
}) {
  const up = data.change >= 0;
  const color = up ? "var(--up)" : "var(--down)";
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-text-muted">{label}</span>
      <span className="telemetry" style={{ color }}>
        ${data.price.toFixed(2)}
      </span>
      <span className="telemetry flex items-center gap-0.5" style={{ color }}>
        {up ? <IconArrowUp className="h-3 w-3" /> : <IconArrowDown className="h-3 w-3" />}
        {Math.abs(data.change).toFixed(2)} ({data.changePercent.toFixed(2)}%)
      </span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-end">
      <span className="text-text-muted text-[10px]">{label}</span>
      <span>{value}</span>
    </div>
  );
}
