"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { IconArrowDown, IconArrowUp, IconSearch } from "./icons";
import { NotificationBell } from "./notification-bell";
import { SymbolSearchInput, type SymbolSearchResult } from "./symbol-search-input";
import { usePoll } from "@/lib/use-poll";
import type { FinnhubQuote } from "@/lib/finnhub";
import type { ExtendedHoursQuote } from "@/lib/yahoo";

const SESSION_LABEL_TH: Record<ExtendedHoursQuote["session"], string> = {
  pre: "ก่อนตลาดเปิด",
  regular: "ระหว่างตลาดเปิด",
  post: "หลังตลาดปิด",
  closed: "ตลาดปิด",
};

/** Session state as a faint corner wash on the header module itself, rather than a
 *  discrete badge — a badge either has to hide on mobile (clutter in an already-tight
 *  row) or crowd it, while a pale tint reads at any width without competing with the
 *  price. Green while the market is actually trading, amber for the extended sessions,
 *  no tint at all when shut — an unlit lamp has no glow, so a closed market gets none. */
const SESSION_GLOW: Record<ExtendedHoursQuote["session"], string> = {
  pre: "rgba(227, 169, 75, 0.10)",
  regular: "rgba(52, 209, 124, 0.10)",
  post: "rgba(227, 169, 75, 0.10)",
  closed: "transparent",
};

export function QuoteHeader({ symbol = "NVDA" }: { symbol?: string }) {
  const router = useRouter();
  const [quote, setQuote] = useState<FinnhubQuote | null>(null);
  const [extended, setExtended] = useState<ExtendedHoursQuote | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "no_key">("loading");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileQuery, setMobileQuery] = useState("");

  function handleMobileSelect(result: SymbolSearchResult) {
    setMobileQuery("");
    setMobileSearchOpen(false);
    router.push(`/dashboard/${result.symbol}`);
  }

  const load = useCallback(() => {
    fetch(`/api/quote?symbol=${symbol}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error === "MISSING_API_KEY") return setStatus("no_key");
        if (data.error || !data.quote) return setStatus("error");
        setQuote(data.quote);
        setExtended(data.extended ?? null);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [symbol]);

  usePoll(load, 20_000);

  const up = quote ? quote.d >= 0 : true;
  const priceColor = up ? "var(--up)" : "var(--down)";

  return (
    <div
      className="module flex flex-wrap items-end justify-between gap-4 px-5 py-4"
      style={{
        backgroundImage: extended
          ? `radial-gradient(ellipse 340px 230px at 0% 0%, ${SESSION_GLOW[extended.session]}, transparent 70%)`
          : undefined,
      }}
      title={extended ? `สถานะตลาด: ${SESSION_LABEL_TH[extended.session]}` : undefined}
    >
      <div className="w-full sm:w-auto">
        <div className="flex flex-nowrap items-center gap-2 sm:gap-2.5 mb-2">
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-text-primary whitespace-nowrap">
            {symbol === "NVDA" ? "NVIDIA CORPORATION" : symbol}
          </h1>
          <span className="telemetry rounded px-2 py-0.5 text-[11px] bg-ch-price-dim text-ch-price whitespace-nowrap">
            NASDAQ · {symbol}
          </span>
          <div className="ml-auto flex flex-col items-end gap-1 sm:hidden">
            <NotificationBell />
            <button
              onClick={() => setMobileSearchOpen((v) => !v)}
              className="flex items-center justify-center rounded px-1.5 py-1 text-text-secondary hover:text-text-primary transition-colors"
              aria-label="ค้นหาหุ้น"
            >
              <IconSearch className="h-4 w-4" />
            </button>
          </div>
        </div>

        {mobileSearchOpen && (
          <div className="mb-2 sm:hidden">
            <SymbolSearchInput
              value={mobileQuery}
              onChange={setMobileQuery}
              onSelect={handleMobileSelect}
              placeholder="ค้นหาหุ้น…"
              autoFocus
            />
          </div>
        )}

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
