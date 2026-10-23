"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { WatchlistItem, WatchlistQuote } from "@/lib/types";
import { usePoll } from "@/lib/use-poll";
import { useAlertsContext } from "./alerts-provider";
import { TickerLogo } from "./ticker-logo";
import { IconPlus } from "./icons";

/**
 * The cockpit's left rail: a compact, always-present instrument switcher. Signed-in
 * owners see their own watchlist; everyone else sees a small public market board so the
 * rail never becomes a password prompt or an empty column on the shareable dashboard.
 */
const MARKET_SYMBOLS = [
  { symbol: "SPY", name: "S&P 500" },
  { symbol: "QQQ", name: "NASDAQ 100" },
  { symbol: "DIA", name: "Dow Jones" },
  { symbol: "IWM", name: "Russell 2000" },
] as const;

interface MarketQuote {
  price: number;
  change: number;
  changePercent: number;
}

function priceText(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function WatchlistRail({
  symbol,
  className,
}: {
  symbol: string;
  className?: string;
}) {
  const { authStatus } = useAlertsContext();
  const authed = authStatus === "authenticated";

  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [quotes, setQuotes] = useState<Record<string, WatchlistQuote>>({});
  const [marketQuotes, setMarketQuotes] = useState<Record<string, MarketQuote>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    try {
      const res = await fetch("/api/watchlist", { cache: "no-store" });
      if (res.status === 401) return;
      const data = (await res.json().catch(() => ({}))) as {
        items?: WatchlistItem[];
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "LOAD_FAILED");
        return;
      }
      setItems(data.items ?? []);
      setError(null);
    } catch {
      setError("LOAD_FAILED");
    }
  }, []);

  const loadQuotes = useCallback(async () => {
    try {
      const res = await fetch("/api/watchlist/quotes", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { quotes?: Record<string, WatchlistQuote> };
      setQuotes(data.quotes ?? {});
    } catch {
      // Keep the last good quote rather than blanking the rail on a hiccup.
    }
  }, []);

  const loadMarket = useCallback(async () => {
    try {
      const results = await Promise.all(
        MARKET_SYMBOLS.map(async ({ symbol: marketSymbol }) => {
          const res = await fetch(`/api/quote?symbol=${encodeURIComponent(marketSymbol)}`, {
            cache: "no-store",
          });
          if (!res.ok) return null;
          const data = (await res.json()) as {
            quote?: { c: number; d: number; dp: number };
          };
          if (!data.quote) return null;
          return [
            marketSymbol,
            {
              price: data.quote.c,
              change: data.quote.d,
              changePercent: data.quote.dp,
            },
          ] as const;
        })
      );
      const next: Record<string, MarketQuote> = {};
      for (const result of results) {
        if (result) next[result[0]] = result[1];
      }
      setMarketQuotes(next);
    } catch {
      // The rail is supplementary; the chart still carries the page.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (authStatus === "checking") {
      setLoading(true);
      return;
    }

    setLoading(true);
    setError(null);

    if (authStatus === "authenticated") {
      loadItems().finally(() => !cancelled && setLoading(false));
    } else {
      setItems([]);
      setQuotes({});
      loadMarket().finally(() => !cancelled && setLoading(false));
    }

    return () => {
      cancelled = true;
    };
  }, [authStatus, loadItems, loadMarket]);

  useEffect(() => {
    if (!authed || items.length === 0) return;
    void loadQuotes();
  }, [authed, items, loadQuotes]);

  usePoll(loadQuotes, 60_000, { enabled: authed && items.length > 0, leading: false });
  usePoll(loadMarket, 60_000, {
    enabled: !authed && authStatus !== "checking",
    leading: false,
  });

  const rows = authed
    ? items.map((item) => ({ symbol: item.symbol, name: item.name }))
    : MARKET_SYMBOLS.map((item) => ({ symbol: item.symbol, name: item.name }));

  const quoteFor = (rowSymbol: string): MarketQuote | null => {
    if (!authed) return marketQuotes[rowSymbol] ?? null;
    const quote = quotes[rowSymbol];
    return quote
      ? { price: quote.price, change: quote.change, changePercent: quote.changePercent }
      : null;
  };

  return (
    <section
      className={`module module-mobile-flat min-h-0 flex-col lg:col-start-1 lg:row-start-1 lg:h-full ${className ?? ""}`}
      aria-label={authed ? "รายการติดตาม" : "ภาพรวมตลาด"}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-seam px-3 py-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="module-label truncate">{authed ? "รายการติดตาม" : "ตลาดวันนี้"}</span>
          <span className="telemetry rounded-[2px] bg-white/[0.05] px-1 text-[9px] leading-4 text-text-muted">
            {loading ? "…" : rows.length}
          </span>
        </div>
        <Link
          href="/watchlist"
          aria-label="จัดการรายการติดตาม"
          className="shrink-0 rounded p-1 text-text-muted transition-colors hover:text-text-primary"
        >
          <IconPlus className="h-3.5 w-3.5" />
        </Link>
      </div>

      {loading ? (
        <div className="scrollbar-none flex min-h-0 flex-col gap-0.5 overflow-y-auto p-1.5">
          {Array.from({ length: authed ? 6 : 4 }).map((_, index) => (
            <div
              key={index}
              className="flex w-full shrink-0 items-center gap-2 px-2 py-2"
            >
              <div className="h-6 w-6 animate-pulse rounded-[3px] bg-white/[0.05]" />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="h-2 w-10 animate-pulse rounded bg-white/[0.05]" />
                <div className="h-1.5 w-16 animate-pulse rounded bg-white/[0.04]" />
              </div>
              <div className="h-2 w-9 animate-pulse rounded bg-white/[0.05]" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col gap-2 px-3 py-4">
          <p className="text-[11px] leading-relaxed text-text-muted">
            {error === "DB_UNAVAILABLE"
              ? "ยังไม่ได้ตั้งค่า Turso — เพิ่ม TURSO_DATABASE_URL และ TURSO_AUTH_TOKEN"
              : "โหลดรายการติดตามไม่สำเร็จ"}
          </p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              loadItems().finally(() => setLoading(false));
            }}
            className="self-start rounded-sm border border-seam px-2 py-1 text-[10px] text-text-secondary transition-colors hover:text-text-primary"
          >
            ลองอีกครั้ง
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="px-3 py-4">
          <p className="text-[11px] leading-relaxed text-text-muted">
            ยังไม่มีหุ้นในรายการติดตาม
          </p>
          <Link
            href="/watchlist"
            className="mt-1.5 inline-block text-[10px] text-ch-price transition-colors hover:brightness-125"
          >
            เพิ่มหุ้นตัวแรก →
          </Link>
        </div>
      ) : (
        <div className="scrollbar-none flex min-h-0 flex-col gap-0.5 overflow-y-auto p-1.5">
          {rows.map((row) => {
            const quote = quoteFor(row.symbol);
            const active = row.symbol === symbol;
            const color = !quote
              ? "var(--text-muted)"
              : quote.changePercent > 0
                ? "var(--up)"
                : quote.changePercent < 0
                  ? "var(--down)"
                  : "var(--text-secondary)";

            return (
              <Link
                key={row.symbol}
                href={`/dashboard/${encodeURIComponent(row.symbol)}`}
                aria-current={active ? "page" : undefined}
                className={`group relative flex w-full shrink-0 items-center gap-2 rounded-[2px] px-2 py-1.5 transition-colors ${
                  active ? "bg-panel-2" : "hover:bg-white/[0.03]"
                }`}
              >
                {active && (
                  <span className="absolute bottom-1.5 left-0 top-1.5 w-[2px] rounded-full bg-ch-price" />
                )}
                <TickerLogo
                  symbol={row.symbol}
                  className="flex h-6 w-6"
                  textClassName="text-[9px]"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="telemetry truncate text-[11px] font-medium text-text-primary">
                      {row.symbol}
                    </span>
                    {active && <span className="h-1 w-1 shrink-0 rounded-full bg-ch-price" />}
                  </div>
                  <p className="truncate text-[10px] leading-tight text-text-muted">
                    {row.name || "—"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="telemetry text-[11px] leading-tight text-text-primary">
                    {quote ? priceText(quote.price) : "—"}
                  </p>
                  <p className="telemetry text-[10px] leading-tight" style={{ color }}>
                    {quote
                      ? `${quote.changePercent >= 0 ? "+" : ""}${quote.changePercent.toFixed(2)}%`
                      : "—"}
                  </p>
                </div>
              </Link>
            );
          })}

          {authed && (
            <Link
              href="/watchlist"
              className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-[2px] border border-dashed border-seam px-2 py-1.5 text-[10px] text-text-muted transition-colors hover:border-seam-bright hover:text-text-secondary"
            >
              <IconPlus className="h-3 w-3" />
              เพิ่มหุ้น
            </Link>
          )}
        </div>
      )}

      <div className="mt-auto shrink-0 border-t border-seam/60 px-3 py-2">
        <Link
          href="/watchlist"
          className="text-[10px] text-text-muted transition-colors hover:text-text-primary"
        >
          {authed ? "จัดการรายการ →" : "เข้าสู่ระบบเพื่อดูรายการติดตาม →"}
        </Link>
      </div>
    </section>
  );
}
