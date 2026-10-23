"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  MAX_WATCHLIST_ITEMS,
  type WatchlistItem,
  type WatchlistQuote,
} from "@/lib/types";
import { usePoll } from "@/lib/use-poll";
import { useAlertsContext } from "./alerts-provider";
import { AlertsPasswordGate } from "./alerts-password-gate";
import { SymbolSearchInput, type SymbolSearchResult } from "./symbol-search-input";
import { IconArrowDown, IconArrowUp, IconStar, IconTrash } from "./icons";

const PREVIEW_LIMIT = 6;
const QUOTE_REFRESH_MS = 60_000;

interface WatchlistPanelProps {
  variant?: "full" | "preview";
  className?: string;
}

function priceText(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function pctText(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function quoteColor(quote: WatchlistQuote | undefined): string {
  if (!quote || quote.change === 0) return "var(--text-secondary)";
  return quote.change > 0 ? "var(--up)" : "var(--down)";
}

function addErrorMessage(code: string | undefined): string {
  if (code === "WATCHLIST_FULL") {
    return `รายการเต็มแล้ว (สูงสุด ${MAX_WATCHLIST_ITEMS} ตัว)`;
  }
  if (code === "INVALID_SYMBOL") return "สัญลักษณ์หุ้นไม่ถูกต้อง";
  if (code === "DB_UNAVAILABLE") return "ยังไม่ได้ตั้งค่า Turso สำหรับเก็บรายการ";
  return "เพิ่มหุ้นไม่สำเร็จ ลองอีกครั้ง";
}

export function WatchlistPanel({ variant = "full", className }: WatchlistPanelProps) {
  const { authStatus } = useAlertsContext();
  const preview = variant === "preview";

  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [quotes, setQuotes] = useState<Record<string, WatchlistQuote>>({});
  const [quoteErrors, setQuoteErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [asOf, setAsOf] = useState<number | null>(null);

  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    try {
      const res = await fetch("/api/watchlist", { cache: "no-store" });
      if (res.status === 401) return;
      const data = (await res.json().catch(() => ({}))) as {
        items?: WatchlistItem[];
        error?: string;
      };
      if (!res.ok) {
        setLoadError(data.error ?? "LOAD_FAILED");
        return;
      }
      setItems(data.items ?? []);
      setLoadError(null);
    } catch {
      setLoadError("LOAD_FAILED");
    }
  }, []);

  const loadQuotes = useCallback(async () => {
    if (items.length === 0) {
      setQuotes({});
      setQuoteErrors({});
      return;
    }
    try {
      const res = await fetch(
        `/api/watchlist/quotes${preview ? `?limit=${PREVIEW_LIMIT}` : ""}`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        quotes?: Record<string, WatchlistQuote>;
        errors?: Record<string, string>;
        asOf?: number;
      };
      setQuotes(data.quotes ?? {});
      setQuoteErrors(data.errors ?? {});
      setAsOf(data.asOf ?? Date.now());
    } catch {
      // Silent: keep the last good quote rather than blanking the whole table on a
      // transient provider/network hiccup.
    }
  }, [items.length, preview]);

  useEffect(() => {
    if (authStatus !== "authenticated") {
      setItems([]);
      setQuotes({});
      setQuoteErrors({});
      setLoading(authStatus === "checking");
      return;
    }
    let cancelled = false;
    setLoading(true);
    loadItems().finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [authStatus, loadItems]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    if (items.length === 0) {
      setQuotes({});
      setQuoteErrors({});
      setAsOf(null);
      return;
    }
    void loadQuotes();
  }, [authStatus, items, loadQuotes]);

  usePoll(loadQuotes, QUOTE_REFRESH_MS, {
    enabled: authStatus === "authenticated" && items.length > 0,
    leading: false,
  });

  async function handleAdd(result: SymbolSearchResult) {
    if (adding) return;
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: result.symbol, name: result.description }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setAddError(addErrorMessage(data.error));
        return;
      }
      setQuery("");
      await loadItems();
    } catch {
      setAddError("เพิ่มหุ้นไม่สำเร็จ ลองอีกครั้ง");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(symbol: string) {
    const previous = items;
    setItems((prev) => prev.filter((item) => item.symbol !== symbol));
    setQuotes((prev) => {
      const next = { ...prev };
      delete next[symbol];
      return next;
    });
    try {
      const res = await fetch(`/api/watchlist/${encodeURIComponent(symbol)}`, {
        method: "DELETE",
      });
      if (!res.ok) setItems(previous);
    } catch {
      setItems(previous);
    }
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    try {
      const res = await fetch("/api/watchlist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols: next.map((item) => item.symbol) }),
      });
      if (!res.ok) {
        await loadItems();
        return;
      }
      const data = (await res.json()) as { items?: WatchlistItem[] };
      if (data.items) setItems(data.items);
    } catch {
      await loadItems();
    }
  }

  if (preview && authStatus !== "authenticated") return null;

  if (!preview) {
    if (authStatus === "checking") {
      return <p className="text-sm text-text-muted">กำลังตรวจสอบสิทธิ์…</p>;
    }
    if (authStatus === "not_configured") {
      return (
        <p className="text-sm text-text-muted">
          ยังไม่ได้ตั้งค่า ALERTS_PASSWORD บนเซิร์ฟเวอร์ — เพิ่มตัวแปรนี้ก่อนจึงจะใช้รายการติดตามได้
        </p>
      );
    }
    if (authStatus !== "authenticated") {
      return <AlertsPasswordGate />;
    }
  }

  const visibleItems = preview ? items.slice(0, PREVIEW_LIMIT) : items;
  const updatedLabel = asOf
    ? new Date(asOf).toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : null;

  return (
    <div className={`module ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-3 border-b border-seam px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <IconStar className="h-3.5 w-3.5 shrink-0 text-ch-price" />
          <span className="module-label">รายการติดตาม</span>
          <span className="telemetry text-[0.625rem] text-text-muted">
            {items.length > 0 ? items.length : ""}
          </span>
        </div>
        {preview ? (
          <Link
            href="/watchlist"
            className="shrink-0 text-[0.6875rem] text-text-muted transition-colors hover:text-text-primary"
          >
            ดูทั้งหมด →
          </Link>
        ) : (
          <span className="telemetry shrink-0 text-[0.625rem] text-text-muted">
            {updatedLabel ? `ราคา ณ ${updatedLabel}` : ""}
          </span>
        )}
      </div>

      {!preview && (
        <div className="border-b border-seam/60 px-4 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="w-full sm:max-w-sm">
              <SymbolSearchInput
                value={query}
                onChange={setQuery}
                onSelect={handleAdd}
                placeholder="เพิ่มหุ้นเข้าดูแล…"
                inputClassName="telemetry w-full rounded border border-seam bg-panel-2 py-2 pl-8 pr-2 text-sm text-text-primary"
              />
            </div>
            <p className="text-[0.6875rem] text-text-muted">
              {adding
                ? "กำลังเพิ่ม…"
                : `เลือกจากผลค้นหาเพื่อเพิ่มทันที · สูงสุด ${MAX_WATCHLIST_ITEMS} ตัว`}
            </p>
          </div>
          {addError && <p className="mt-2 text-xs text-ch-alert">{addError}</p>}
        </div>
      )}

      {loading ? (
        <p className="px-4 py-6 text-sm text-text-muted">กำลังโหลด…</p>
      ) : loadError ? (
        <p className="px-4 py-6 text-sm text-text-muted">
          {loadError === "DB_UNAVAILABLE"
            ? "ยังไม่ได้ตั้งค่า Turso — เพิ่ม TURSO_DATABASE_URL และ TURSO_AUTH_TOKEN ก่อน"
            : "โหลดรายการติดตามไม่สำเร็จ"}
        </p>
      ) : visibleItems.length === 0 ? (
        <div className="px-4 py-6">
          <p className="text-sm text-text-muted">ยังไม่มีหุ้นในรายการติดตาม</p>
          {preview ? (
            <Link
              href="/watchlist"
              className="mt-2 inline-block text-xs text-ch-price transition-colors hover:brightness-125"
            >
              เพิ่มหุ้นตัวแรก →
            </Link>
          ) : (
            <p className="mt-1 text-xs text-text-muted">
              พิมพ์ชื่อหรือ ticker ด้านบน แล้วเลือกจากผลค้นหา
            </p>
          )}
        </div>
      ) : (
        <ul>
          {visibleItems.map((item, index) => {
            const quote = quotes[item.symbol];
            const quoteError = quoteErrors[item.symbol];
            const color = quoteColor(quote);

            if (preview) {
              return (
                <li key={item.symbol} className="border-b border-seam/60 last:border-b-0">
                  <Link
                    href={`/dashboard/${encodeURIComponent(item.symbol)}`}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-white/[0.02]"
                  >
                    <div className="flex min-w-0 items-baseline gap-2">
                      <span className="telemetry text-sm font-medium text-text-primary">
                        {item.symbol}
                      </span>
                      {item.name && (
                        <span className="truncate text-[0.6875rem] text-text-muted">
                          {item.name}
                        </span>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      {quote ? (
                        <>
                          <span className="telemetry text-sm" style={{ color }}>
                            ${priceText(quote.price)}
                          </span>
                          <span className="telemetry ml-2 text-[0.6875rem]" style={{ color }}>
                            {pctText(quote.changePercent)}
                          </span>
                        </>
                      ) : (
                        <span className="telemetry text-xs text-text-muted">
                          {quoteError ? "—" : "กำลังโหลด…"}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            }

            return (
              <li
                key={item.symbol}
                className="flex flex-wrap items-center gap-3 border-b border-seam/60 px-4 py-3 last:border-b-0"
              >
                <Link
                  href={`/dashboard/${encodeURIComponent(item.symbol)}`}
                  className="group min-w-0 flex-1"
                >
                  <span className="telemetry text-sm font-medium text-text-primary transition-colors group-hover:text-ch-price">
                    {item.symbol}
                  </span>
                  <p className="truncate text-[0.6875rem] text-text-muted">{item.name || "—"}</p>
                </Link>

                <div className="w-28 shrink-0 text-right">
                  {quote ? (
                    <>
                      <p className="telemetry text-sm" style={{ color }}>
                        ${priceText(quote.price)}
                      </p>
                      <p className="telemetry flex items-center justify-end gap-0.5 text-[0.625rem]" style={{ color }}>
                        {quote.change > 0 && <IconArrowUp className="h-2.5 w-2.5" />}
                        {quote.change < 0 && <IconArrowDown className="h-2.5 w-2.5" />}
                        {Math.abs(quote.change).toFixed(2)} ({pctText(quote.changePercent)})
                      </p>
                    </>
                  ) : (
                    <p className="telemetry text-xs text-text-muted">
                      {quoteError ? "ไม่มีข้อมูล" : "กำลังโหลด…"}
                    </p>
                  )}
                </div>

                <div className="hidden w-40 shrink-0 text-right telemetry text-[0.625rem] text-text-muted md:block">
                  {quote ? (
                    <>
                      <p>เปิด {priceText(quote.open)}</p>
                      <p>
                        สูง {priceText(quote.high)} · ต่ำ {priceText(quote.low)}
                      </p>
                    </>
                  ) : (
                    <p>—</p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => handleMove(index, -1)}
                    disabled={index === 0}
                    aria-label={`เลื่อน ${item.symbol} ขึ้น`}
                    className="rounded p-1.5 text-text-muted transition-colors hover:text-text-primary disabled:opacity-25"
                  >
                    <IconArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(index, 1)}
                    disabled={index === items.length - 1}
                    aria-label={`เลื่อน ${item.symbol} ลง`}
                    className="rounded p-1.5 text-text-muted transition-colors hover:text-text-primary disabled:opacity-25"
                  >
                    <IconArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.symbol)}
                    aria-label={`ลบ ${item.symbol} ออกจากรายการ`}
                    className="rounded p-1.5 text-text-muted transition-colors hover:text-ch-alert"
                  >
                    <IconTrash className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {preview && items.length > PREVIEW_LIMIT && (
        <div className="border-t border-seam/60 px-4 py-2 text-right">
          <Link
            href="/watchlist"
            className="text-[0.6875rem] text-text-muted transition-colors hover:text-text-primary"
          >
            อีก {items.length - PREVIEW_LIMIT} ตัว →
          </Link>
        </div>
      )}
    </div>
  );
}
