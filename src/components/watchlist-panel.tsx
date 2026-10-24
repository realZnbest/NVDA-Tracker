"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import {
  MAX_WATCHLIST_ITEMS,
  type WatchlistItem,
  type WatchlistMarket,
  type WatchlistQuote,
} from "@/lib/types";
import { usePoll } from "@/lib/use-poll";
import { useAlertsContext } from "./alerts-provider";
import { AlertsPasswordGate } from "./alerts-password-gate";
import { SessionBadge } from "./session-badge";
import { SymbolSearchInput, type SymbolSearchResult } from "./symbol-search-input";
import {
  IconArrowDown,
  IconArrowUp,
  IconChevronDown,
  IconInfo,
  IconPlus,
  IconTrash,
} from "./icons";

const PREVIEW_LIMIT = 6;
/** The server overlays live websocket prints, so polling the app every 5s is nearly free
 *  in provider quota. Outside trading hours nothing moves; drop back to 60s. */
const QUOTE_REFRESH_LIVE_MS = 5_000;
const QUOTE_REFRESH_IDLE_MS = 60_000;
const MARKET_REFRESH_MS = 5 * 60_000;

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
  return `${Math.abs(value).toFixed(2)}%`;
}

/**
 * A price that briefly tints green/red when the websocket print changes it, so a live
 * row reads as alive without animating every row on every poll (unchanged values never
 * flash). The tint fades out via transition-colors once the flash state clears.
 */
function LivePrice({ value }: { value: number }) {
  const previous = useRef(value);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (value === previous.current) return;
    setFlash(value > previous.current ? "up" : "down");
    previous.current = value;
    const timer = setTimeout(() => setFlash(null), 700);
    return () => clearTimeout(timer);
  }, [value]);

  return (
    <span
      className={`-mx-1 rounded-sm px-1 transition-colors duration-700 ${
        flash === "up" ? "bg-up/20" : flash === "down" ? "bg-down/20" : "bg-transparent"
      }`}
    >
      {priceText(value)}
    </span>
  );
}

function quoteColor(quote: WatchlistQuote | undefined): string {
  if (!quote || quote.change === 0) return "var(--text-secondary)";
  return quote.change > 0 ? "var(--up)" : "var(--down)";
}

/** Plain US tickers (including dotted share classes) vs. indices, FX and crypto. The
 *  badge is a label, not a data claim, so unknown shapes simply get no badge. */
function instrumentLabel(symbol: string): string | null {
  if (/^[A-Z]{1,5}(\.[A-Z]{1,2})?$/.test(symbol)) return "หุ้นสหรัฐฯ";
  if (symbol.startsWith("^")) return "ดัชนี";
  if (symbol.endsWith("=X")) return "ค่าเงิน";
  if (/-USD(T)?$/.test(symbol)) return "คริปโต";
  return null;
}

function addErrorMessage(code: string | undefined): string {
  if (code === "WATCHLIST_FULL") {
    return `รายการเต็มแล้ว (สูงสุด ${MAX_WATCHLIST_ITEMS} ตัว)`;
  }
  if (code === "INVALID_SYMBOL") return "สัญลักษณ์หุ้นไม่ถูกต้อง";
  if (code === "DB_UNAVAILABLE") return "ยังไม่ได้ตั้งค่า Turso สำหรับเก็บรายการ";
  return "เพิ่มหุ้นไม่สำเร็จ ลองอีกครั้ง";
}

function StockLogo({ symbol }: { symbol: string }) {
  const [failed, setFailed] = useState(false);
  const monogram = symbol.replace(/^\^/, "").slice(0, 1);

  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-panel-2 ring-1 ring-white/10 sm:h-9 sm:w-9">
      {failed ? (
        <span className="telemetry text-[0.625rem] font-semibold text-text-secondary">
          {monogram}
        </span>
      ) : (
        // Brand marks come from Parqet's public symbol-logo endpoint; a missing logo
        // falls back to the monogram so the row never collapses.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://assets.parqet.com/logos/symbol/${encodeURIComponent(symbol)}?format=png`}
          alt=""
          loading="lazy"
          className="h-full w-full rounded-md object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}

function Sparkline({
  points,
  color,
  className = "",
}: {
  points: number[];
  color: string;
  className?: string;
}) {
  const gradientId = useId().replace(/:/g, "");
  const width = 96;
  const height = 40;
  // Keep the desktop sparkline inline in the row on every screen size. Phones have
  // enough width for the full 96px chart once the row uses the same 3-column grid.
  const sizeClass = `h-10 w-24 shrink-0 overflow-visible ${className}`;

  if (points.length < 2) {
    return <div className={sizeClass} aria-hidden="true" />;
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = width / (points.length - 1);
  const xy = points.map((value, index) => {
    const x = index * step;
    const y = height - 2 - ((value - min) / span) * (height - 4);
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  const line = `M${xy.join(" L")}`;
  const area = `${line} L${width} ${height} L0 ${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={sizeClass}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.38" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function WatchlistPanel({ variant = "full", className }: WatchlistPanelProps) {
  const { authStatus } = useAlertsContext();
  const preview = variant === "preview";

  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [quotes, setQuotes] = useState<Record<string, WatchlistQuote>>({});
  const [quoteErrors, setQuoteErrors] = useState<Record<string, string>>({});
  const [market, setMarket] = useState<Record<string, WatchlistMarket>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [asOf, setAsOf] = useState<number | null>(null);
  /** True only when the server confirms this process is receiving websocket prints. */
  const [live, setLive] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

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
    try {
      const res = await fetch(
        `/api/watchlist/quotes${preview ? `?limit=${PREVIEW_LIMIT}` : ""}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        setLive(false);
        return;
      }
      const data = (await res.json()) as {
        quotes?: Record<string, WatchlistQuote>;
        errors?: Record<string, string>;
        asOf?: number;
        live?: boolean;
      };
      setQuotes(data.quotes ?? {});
      setQuoteErrors(data.errors ?? {});
      setAsOf(data.asOf ?? Date.now());
      setLive(Boolean(data.live));
    } catch {
      setLive(false);
      // Silent: keep the last good quote rather than blanking the whole table on a
      // transient provider/network hiccup.
    }
  }, [preview]);

  const loadMarket = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/watchlist/market${preview ? `?limit=${PREVIEW_LIMIT}` : ""}`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        market?: Record<string, WatchlistMarket>;
      };
      setMarket(data.market ?? {});
    } catch {
      // Sparkline / after-hours are best-effort; the quote rows still render.
    }
  }, [preview]);

  /** Set when the auth effect already fired quotes + market alongside the list, so the
   *  first arrival of the symbols doesn't trigger the same two requests again. */
  const prefetchedRef = useRef(false);
  const symbolsKey = items.map((item) => item.symbol).join(",");

  useEffect(() => {
    if (authStatus !== "authenticated") {
      prefetchedRef.current = false;
      setItems([]);
      setQuotes({});
      setQuoteErrors({});
      setMarket({});
      setLive(false);
      setLoading(authStatus === "checking");
      return;
    }
    let cancelled = false;
    setLoading(true);
    // quotes/market read the list server-side themselves, so they don't need to wait for
    // /api/watchlist to come back — all three go out together instead of in sequence.
    prefetchedRef.current = true;
    void loadQuotes();
    void loadMarket();
    loadItems().finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [authStatus, loadItems, loadQuotes, loadMarket]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    if (symbolsKey === "") {
      // Nothing followed (yet): the prefetched responses are empty, nothing to refetch.
      // Once the list has finished loading and is still empty, drop the flag so the
      // first symbol the owner adds is fetched instead of being skipped as "prefetched".
      if (!prefetchedRef.current) {
        setQuotes({});
        setQuoteErrors({});
        setMarket({});
        setAsOf(null);
        setLive(false);
      } else if (!loading) {
        prefetchedRef.current = false;
      }
      return;
    }
    if (prefetchedRef.current) {
      prefetchedRef.current = false;
      return;
    }
    void loadQuotes();
    void loadMarket();
  }, [authStatus, symbolsKey, loading, loadQuotes, loadMarket]);

  // One session for the whole list: if any followed instrument is trading, prices are
  // moving somewhere on the page, so keep the fast cadence. The slow cadence only when
  // every row is shut — there is nothing to animate then.
  const sessions = Object.values(market).map((entry) => entry.session);
  const session: WatchlistMarket["session"] | null =
    sessions.length === 0
      ? null
      : sessions.includes("regular")
        ? "regular"
        : sessions.includes("pre")
          ? "pre"
          : sessions.includes("post")
            ? "post"
            : "closed";
  const quoteRefreshMs =
    session && session !== "closed" && live ? QUOTE_REFRESH_LIVE_MS : QUOTE_REFRESH_IDLE_MS;

  usePoll(loadQuotes, quoteRefreshMs, {
    enabled: authStatus === "authenticated" && items.length > 0,
    leading: false,
  });

  usePoll(loadMarket, MARKET_REFRESH_MS, {
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

  function focusAdd() {
    const input = document.querySelector<HTMLInputElement>("#watchlist-add input");
    input?.scrollIntoView({ block: "center", behavior: "smooth" });
    input?.focus();
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
    <div className={`module overflow-hidden ${className ?? ""}`}>
      <div className="relative flex items-center justify-between gap-3 px-4 pb-3 pt-4 sm:px-5">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_280px_120px_at_50%_0%,rgba(121,185,0,0.10),transparent_70%)]"
        />
        <div className="relative flex min-w-0 items-center gap-1.5">
          <h2 className="truncate text-[1.0625rem] font-semibold text-text-primary">
            รายการติดตาม
          </h2>
          <span
            title="หุ้นที่คุณติดตาม ราคาอัปเดตทุก 5 วินาทีขณะตลาดเปิด (สำรองทุก 60 วินาที)"
            className="shrink-0 text-text-muted"
          >
            <IconInfo className="h-4 w-4" />
          </span>
        </div>

        <div className="relative flex shrink-0 items-center gap-1">
          {preview ? (
            <Link
              href="/watchlist"
              aria-label="เพิ่มหุ้นเข้าดูแล"
              className="rounded p-1.5 text-text-secondary transition-colors hover:text-text-primary"
            >
              <IconPlus className="h-5 w-5" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={focusAdd}
              aria-label="เพิ่มหุ้นเข้าดูแล"
              className="rounded p-1.5 text-text-secondary transition-colors hover:text-text-primary"
            >
              <IconPlus className="h-5 w-5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "แสดงรายการ" : "ย่อรายการ"}
            className="rounded p-1.5 text-text-secondary transition-colors hover:text-text-primary"
          >
            <IconChevronDown
              className={`h-4 w-4 transition-transform ${collapsed ? "" : "rotate-180"}`}
            />
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          <div className="flex items-baseline justify-between gap-3 border-b border-seam px-4 pb-2.5 sm:px-5">
            <span className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[0.6875rem] text-text-muted">
              <SessionBadge session={session} />
              <span className="truncate">
                {loading ? "…" : `${items.length} รายการ`}
                {!preview && updatedLabel ? ` · อัปเดต ${updatedLabel}` : ""}
              </span>
            </span>
            <span className="shrink-0 whitespace-nowrap text-[0.6875rem] text-text-muted">
              % เปลี่ยนแปลงจากวันก่อนหน้า
            </span>
          </div>

          {!preview && (
            <div className="border-b border-seam/60 px-4 py-2.5 sm:px-5">
              <div className="flex items-center gap-3">
                <div id="watchlist-add" className="min-w-0 flex-1 sm:max-w-[320px]">
                  <SymbolSearchInput
                    value={query}
                    onChange={setQuery}
                    onSelect={handleAdd}
                    placeholder="เพิ่มหุ้นเข้าดูแล…"
                    inputClassName="telemetry w-full rounded border border-seam bg-panel-2 py-1.5 pl-8 pr-2 text-sm text-text-primary"
                  />
                </div>
                <p className="hidden text-[0.6875rem] text-text-muted sm:block">
                  {adding
                    ? "กำลังเพิ่ม…"
                    : `เลือกจากผลค้นหาเพื่อเพิ่มทันที · สูงสุด ${MAX_WATCHLIST_ITEMS} ตัว`}
                </p>
              </div>
              {addError && <p className="mt-2 text-xs text-ch-alert">{addError}</p>}
            </div>
          )}

          {loading ? (
            <p className="px-4 py-6 text-sm text-text-muted sm:px-5">กำลังโหลด…</p>
          ) : loadError ? (
            <p className="px-4 py-6 text-sm text-text-muted sm:px-5">
              {loadError === "DB_UNAVAILABLE"
                ? "ยังไม่ได้ตั้งค่า Turso — เพิ่ม TURSO_DATABASE_URL และ TURSO_AUTH_TOKEN ก่อน"
                : "โหลดรายการติดตามไม่สำเร็จ"}
            </p>
          ) : visibleItems.length === 0 ? (
            <div className="px-4 py-6 sm:px-5">
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
                const snapshot = market[item.symbol];
                const extended = snapshot?.post ?? snapshot?.pre ?? null;
                const extendedLabel = snapshot?.post ? "หลังตลาดปิด" : "ก่อนตลาดเปิด";
                const color = quoteColor(quote);
                const label = instrumentLabel(item.symbol);
                // The extended-hours delta is measured against the live price shown in the
                // row, not the previous close, so the two numbers on the row agree.
                const extendedChange =
                  extended && quote ? extended.price - quote.price : extended?.change ?? 0;
                const extendedPercent =
                  extended && quote && quote.price > 0
                    ? (extendedChange / quote.price) * 100
                    : extended?.changePercent ?? 0;

                return (
                  <li
                    key={item.symbol}
                    className="border-t border-seam/40 first:border-t-0"
                  >
                    <Link
                      href={`/dashboard/${encodeURIComponent(item.symbol)}`}
                      className="group grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-1.5 px-4 py-3 transition-colors hover:bg-white/[0.02] sm:gap-3 sm:px-5 sm:py-3.5"
                    >
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
                          <StockLogo symbol={item.symbol} />
                          <div className="min-w-0">
                            <p className="telemetry truncate text-[0.9375rem] font-semibold leading-tight text-text-primary sm:text-base">
                              {item.symbol}
                            </p>
                            <p className="truncate text-[0.625rem] leading-tight text-text-muted">
                              {item.name || "—"}
                            </p>
                          </div>
                        </div>
                      </div>

                      <Sparkline
                        points={snapshot?.sparkline ?? []}
                        color={color}
                      />

                      <div className="min-w-0 text-right sm:pl-3">
                        {extended && (
                          <p className="mb-0.5 hidden whitespace-nowrap text-[0.5625rem] text-text-muted min-[390px]:block sm:text-[0.625rem]">
                            {extendedLabel}{" "}
                            <span className="telemetry text-text-secondary">
                              {priceText(extended.price)}
                            </span>{" "}
                            <span
                              className="telemetry inline-flex items-center gap-0.5"
                              style={{
                                color: extendedChange >= 0 ? "var(--up)" : "var(--down)",
                              }}
                            >
                              {extendedChange >= 0 ? (
                                <IconArrowUp className="h-2.5 w-2.5" />
                              ) : (
                                <IconArrowDown className="h-2.5 w-2.5" />
                              )}
                              {pctText(extendedPercent)}
                            </span>
                          </p>
                        )}
                        <p className="telemetry whitespace-nowrap text-[0.9375rem] font-semibold leading-tight text-text-primary sm:text-lg">
                          {quote ? <LivePrice value={quote.price} /> : "—"}
                          {quote && label === "หุ้นสหรัฐฯ" && (
                            <span className="ml-1 text-[0.5625rem] font-normal text-text-muted sm:text-[0.625rem]">
                              USD
                            </span>
                          )}
                        </p>
                        {quote ? (
                          <span
                            className="mt-1 inline-flex items-center gap-0.5 rounded-sm px-1.5 py-0.5 text-[0.6875rem] font-medium leading-none sm:text-xs"
                            style={{
                              color,
                              backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`,
                            }}
                          >
                            {quote.change > 0 && (
                              <IconArrowUp className="h-3 w-3" />
                            )}
                            {quote.change < 0 && (
                              <IconArrowDown className="h-3 w-3" />
                            )}
                            {pctText(quote.changePercent)}
                          </span>
                        ) : (
                          <span className="text-[0.625rem] text-text-muted">
                            {quoteError ? "—" : "กำลังโหลด…"}
                          </span>
                        )}
                      </div>
                    </Link>

                    {!preview && (
                      <div className="flex items-center justify-end gap-0.5 px-4 pb-2 sm:px-5">
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
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {preview && items.length > PREVIEW_LIMIT && (
            <div className="border-t border-seam/60 px-4 py-2 text-right sm:px-5">
              <Link
                href="/watchlist"
                className="text-[0.6875rem] text-text-muted transition-colors hover:text-text-primary"
              >
                อีก {items.length - PREVIEW_LIMIT} ตัว →
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
