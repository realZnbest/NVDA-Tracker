"use client";

import { useEffect, useState } from "react";
import { IconArrowDown, IconArrowUp } from "./icons";
import type { FinnhubQuote } from "@/lib/finnhub";

export function QuoteHeader() {
  const [quote, setQuote] = useState<FinnhubQuote | null>(null);
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

  return (
    <div className="module flex flex-wrap items-end justify-between gap-4 px-5 py-4">
      <div>
        <div className="module-label mb-1">NVIDIA CORPORATION — NASDAQ: NVDA</div>
        {status === "ready" && quote ? (
          <div className="flex items-baseline gap-3">
            <span className="telemetry text-4xl font-medium text-ch-price">
              ${quote.c.toFixed(2)}
            </span>
            <span
              className={`flex items-center gap-1 telemetry text-sm ${up ? "text-up" : "text-down"}`}
            >
              {up ? <IconArrowUp className="h-3.5 w-3.5" /> : <IconArrowDown className="h-3.5 w-3.5" />}
              {Math.abs(quote.d).toFixed(2)} ({quote.dp.toFixed(2)}%)
            </span>
          </div>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-end">
      <span className="text-text-muted text-[10px]">{label}</span>
      <span>{value}</span>
    </div>
  );
}
