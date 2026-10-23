"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IconArrowDown, IconArrowUp, IconSearch, IconStar } from "./icons";
import { NotificationBell } from "./notification-bell";
import { SymbolSearchInput, type SymbolSearchResult } from "./symbol-search-input";
import { TickerLogo } from "./ticker-logo";
import { useAlertsContext } from "./alerts-provider";
import { usePoll } from "@/lib/use-poll";
import type { FinnhubQuote } from "@/lib/finnhub";
import type { ExtendedHoursQuote } from "@/lib/yahoo";
import type { WatchlistItem } from "@/lib/types";

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

// Yahoo reports exchange codes (NMS, NYQ, PCX, ...) rather than marketing names.
function exchangeLabel(name: string): string {
  const code = name.toUpperCase();
  if (["NMS", "NGM", "NCM"].includes(code) || /nasdaq/i.test(name)) return "NASDAQ";
  if (["NYQ", "NYS"].includes(code) || /nyse|new york/i.test(name)) return "NYSE";
  if (["PCX", "ARCA"].includes(code) || /arca/i.test(name)) return "NYSE ARCA";
  if (["ASE", "AMEX"].includes(code) || /amex|american/i.test(name)) return "AMEX";
  if (["BTS", "CBOE"].includes(code) || /bats|cboe/i.test(name)) return "CBOE";
  if (["PNK", "OQB", "OQX"].includes(code)) return "OTC";
  return name;
}

/**
 * The cockpit's instrument header: identity, live price, day range, and the one personal
 * action (follow) — compact enough that the chart below still owns the first viewport.
 */
export function QuoteHeader({ symbol = "NVDA" }: { symbol?: string }) {
  const router = useRouter();
  const { authStatus } = useAlertsContext();
  const [quote, setQuote] = useState<FinnhubQuote | null>(null);
  const [extended, setExtended] = useState<ExtendedHoursQuote | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "no_key">("loading");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileQuery, setMobileQuery] = useState("");
  const [following, setFollowing] = useState<boolean | null>(null);
  const [followBusy, setFollowBusy] = useState(false);

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

  usePoll(load, 3_000);

  // Follow state is private. Only ask for it inside an authenticated owner session;
  // unauthenticated visitors still get the star as a doorway to the watchlist page.
  useEffect(() => {
    if (authStatus !== "authenticated") {
      setFollowing(null);
      return;
    }
    let cancelled = false;
    fetch("/api/watchlist", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { items?: WatchlistItem[] } | null) => {
        if (cancelled || !data?.items) return;
        setFollowing(data.items.some((item) => item.symbol === symbol));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authStatus, symbol]);

  // Outside regular hours, `quote.c` keeps tracking pre/post trade prints (see
  // /api/quote), which makes the headline number jump around before/after the bell as
  // if it were the "real" price. The headline should stay pinned to the last official
  // regular-session trade; pre/post movement belongs only in the ExtendedRow below.
  const useRegularPrice = quote && extended && extended.session !== "regular";
  const mainPrice = useRegularPrice ? extended!.regularMarketPrice : quote?.c;
  const mainChange = useRegularPrice ? extended!.regularMarketPrice - quote!.pc : quote?.d;
  const mainChangePercent = useRegularPrice
    ? quote!.pc
      ? ((extended!.regularMarketPrice - quote!.pc) / quote!.pc) * 100
      : 0
    : quote?.dp;

  const up = mainChange !== undefined ? mainChange >= 0 : true;
  const priceColor = up ? "var(--up)" : "var(--down)";
  const companyName = extended?.companyName?.toUpperCase();
  const exchange = extended?.exchangeName ? exchangeLabel(extended.exchangeName) : null;
  const quoteTimestamp = quote
    ? new Date(quote.t * 1000).toLocaleString("th-TH", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  async function toggleFollow() {
    if (authStatus !== "authenticated") {
      router.push("/watchlist");
      return;
    }
    if (followBusy) return;
    setFollowBusy(true);
    const next = !following;
    setFollowing(next);
    try {
      const res = following
        ? await fetch(`/api/watchlist/${encodeURIComponent(symbol)}`, { method: "DELETE" })
        : await fetch("/api/watchlist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ symbol, name: companyName ?? symbol }),
          });
      if (!res.ok) setFollowing(!next);
    } catch {
      setFollowing(!next);
    } finally {
      setFollowBusy(false);
    }
  }

  return (
    <div
      className="module relative px-4 py-2.5 sm:px-5"
      style={{
        backgroundImage: extended
          ? `radial-gradient(ellipse 340px 230px at 0% 0%, ${SESSION_GLOW[extended.session]}, transparent 70%)`
          : undefined,
      }}
      title={extended ? `สถานะตลาด: ${SESSION_LABEL_TH[extended.session]}` : undefined}
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <TickerLogo symbol={symbol} className="h-9 w-9 sm:h-10 sm:w-10" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="telemetry text-base font-semibold tracking-[0.02em] text-text-primary">
                {symbol}
              </h1>
              {exchange && (
                <span className="telemetry rounded-[2px] bg-ch-price-dim px-1.5 py-0.5 text-[9px] leading-none text-ch-price">
                  {exchange}
                </span>
              )}
              <button
                type="button"
                onClick={toggleFollow}
                disabled={
                  followBusy ||
                  authStatus === "checking" ||
                  (authStatus === "authenticated" && following === null)
                }
                aria-pressed={following === true}
                title={following ? "นำออกจากรายการติดตาม" : "เพิ่มในรายการติดตาม"}
                className={`flex items-center gap-1 rounded-sm px-1 py-0.5 text-[10px] transition-colors disabled:opacity-40 ${
                  following
                    ? "text-ch-price"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                <IconStar
                  className={`h-3.5 w-3.5 ${following ? "fill-current" : ""}`}
                />
                <span className="hidden xl:inline">
                  {following ? "ติดตามอยู่" : "ติดตาม"}
                </span>
              </button>
            </div>
            <p className="mt-0.5 max-w-[230px] truncate text-xs leading-tight text-text-secondary">
              {companyName ?? (symbol === "NVDA" ? "NVIDIA CORPORATION" : symbol)}
            </p>
          </div>
        </div>

        <div className="order-last flex w-full min-w-0 flex-col justify-center sm:order-none sm:w-auto sm:border-l sm:border-seam sm:pl-5">
          {status === "ready" && quote ? (
            <>
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <span
                  className="telemetry text-[1.75rem] font-medium leading-none sm:text-[2rem]"
                  style={{ color: priceColor }}
                >
                  ${mainPrice!.toFixed(2)}
                </span>
                <span
                  className="telemetry flex items-center gap-0.5 rounded-[2px] px-1.5 py-1 text-[11px] leading-none"
                  style={{
                    color: priceColor,
                    backgroundColor: `color-mix(in srgb, ${priceColor} 12%, transparent)`,
                  }}
                >
                  {up ? (
                    <IconArrowUp className="h-3 w-3" />
                  ) : (
                    <IconArrowDown className="h-3 w-3" />
                  )}
                  {Math.abs(mainChange!).toFixed(2)} ({Math.abs(mainChangePercent!).toFixed(2)}%)
                </span>
                {quoteTimestamp && (
                  <span className="telemetry hidden whitespace-nowrap text-[10px] text-text-muted xl:inline">
                    · {useRegularPrice ? "ราคาปิดตลาดล่าสุด · " : ""}
                    ข้อมูล ณ {quoteTimestamp}
                  </span>
                )}
              </div>
              {quoteTimestamp && (
                <p className="telemetry mt-1 text-[10px] leading-none text-text-muted xl:hidden">
                  {useRegularPrice ? "ราคาปิดตลาดล่าสุด · " : ""}
                  ข้อมูล ณ {quoteTimestamp}
                </p>
              )}
            </>
          ) : status === "no_key" ? (
            <p className="text-xs text-text-muted">
              ยังไม่ได้ตั้งค่า FINNHUB_API_KEY — ใส่คีย์ใน .env.local แล้วรีสตาร์ทเซิร์ฟเวอร์
            </p>
          ) : status === "error" ? (
            <p className="text-xs text-text-muted">โหลดราคาล่าสุดไม่สำเร็จ</p>
          ) : (
            <div className="flex flex-col gap-2">
              <span className="telemetry animate-pulse text-[1.75rem] leading-none text-text-muted sm:text-[2rem]">
                — — —
              </span>
              <span className="telemetry text-[10px] text-text-muted">กำลังโหลดราคา…</span>
            </div>
          )}
        </div>

        {status === "ready" && quote && (
          <DayStats
            quote={quote}
            className="ml-auto hidden items-center gap-5 border-l border-seam pl-5 sm:flex"
          />
        )}

        <div className="ml-auto flex items-center gap-1 sm:hidden">
          <NotificationBell />
          <button
            onClick={() => setMobileSearchOpen((v) => !v)}
            className="flex items-center justify-center rounded px-1.5 py-1 text-text-secondary transition-colors hover:text-text-primary"
            aria-label="ค้นหาหุ้น"
            aria-expanded={mobileSearchOpen}
          >
            <IconSearch className="h-4 w-4" />
          </button>
        </div>
      </div>

      {mobileSearchOpen && (
        <div className="mt-2 sm:hidden">
          <SymbolSearchInput
            value={mobileQuery}
            onChange={setMobileQuery}
            onSelect={handleMobileSelect}
            placeholder="ค้นหาหุ้น…"
            autoFocus
          />
        </div>
      )}

      {status === "ready" && quote && (
        <DayStats
          quote={quote}
          className="mt-2.5 grid grid-cols-4 gap-2 border-t border-seam/60 pt-2 sm:hidden"
        />
      )}

      {status === "ready" && extended && (extended.pre || extended.post) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-seam/60 pt-2">
          {extended.pre && (
            <ExtendedRow
              label={SESSION_LABEL_TH.pre}
              price={extended.pre.price}
              baseline={mainPrice!}
            />
          )}
          {extended.post && (
            <ExtendedRow
              label={SESSION_LABEL_TH.post}
              price={extended.post.price}
              baseline={mainPrice!}
            />
          )}
        </div>
      )}
    </div>
  );
}

function DayStats({ quote, className }: { quote: FinnhubQuote; className?: string }) {
  return (
    <dl className={className}>
      <Stat label="เปิด" value={quote.o.toFixed(2)} />
      <Stat label="สูงสุด" value={quote.h.toFixed(2)} />
      <Stat label="ต่ำสุด" value={quote.l.toFixed(2)} />
      <Stat label="ปิดก่อนหน้า" value={quote.pc.toFixed(2)} />
    </dl>
  );
}

/**
 * Extended-hours delta is measured against `baseline` — the regular-session price shown
 * directly above it — not against yesterday's close as the market-data convention (and
 * the feed's own `change` field) would have it. The convention answers "how far has the
 * stock moved today", which the main price line already says; stacked under that line the
 * useful question is "is it moving up or down from here", and a pre-market print below the
 * regular price reading green because it's still above yesterday's close contradicts the
 * two numbers sitting side by side on screen. Deriving the arrow from the displayed
 * baseline keeps the row self-consistent by construction.
 */
function ExtendedRow({
  label,
  price,
  baseline,
}: {
  label: string;
  price: number;
  baseline: number;
}) {
  const change = baseline > 0 ? price - baseline : 0;
  const changePercent = baseline > 0 ? (change / baseline) * 100 : 0;
  // Anything under half a cent prints as "0.00" — colour it green/red and the tint would
  // be claiming a direction the digits don't show, so those round to flat too.
  const direction = Math.abs(change) < 0.005 ? 0 : Math.sign(change);
  const color =
    direction > 0 ? "var(--up)" : direction < 0 ? "var(--down)" : "var(--text-secondary)";
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="text-text-muted">{label}</span>
      <span className="telemetry" style={{ color }}>
        ${price.toFixed(2)}
      </span>
      <span className="telemetry flex items-center gap-0.5" style={{ color }}>
        {direction > 0 && <IconArrowUp className="h-3 w-3" />}
        {direction < 0 && <IconArrowDown className="h-3 w-3" />}
        {Math.abs(change).toFixed(2)} ({Math.abs(changePercent).toFixed(2)}%)
      </span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[10px] leading-none text-text-muted">{label}</dt>
      <dd className="telemetry text-[11px] leading-none text-text-secondary">{value}</dd>
    </div>
  );
}
