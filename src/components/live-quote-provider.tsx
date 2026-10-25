"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePoll } from "@/lib/use-poll";
import type { FinnhubQuote } from "@/lib/finnhub";
import type { ExtendedHoursQuote } from "@/lib/yahoo";

type QuoteStatus = "loading" | "ready" | "error" | "no_key";

interface LiveQuoteState {
  quote: FinnhubQuote | null;
  extended: ExtendedHoursQuote | null;
  status: QuoteStatus;
}

const LiveQuoteContext = createContext<LiveQuoteState | null>(null);

/**
 * Session-aware cadence for the one shared quote poll. Only regular trading moves a
 * price tick-by-tick; pre/post is thin, and a closed market cannot change at all.
 * Slowing down outside the regular session cuts Finnhub `/quote` calls and the
 * Yahoo extended-hours call inside `/api/quote` by 10x overnight while still
 * noticing the next session within half a minute.
 */
function pollIntervalMs(session: ExtendedHoursQuote["session"] | null): number {
  if (session === "regular") return 3_000;
  if (session === "pre" || session === "post") return 10_000;
  if (session === "closed") return 30_000;
  // Yahoo's extended quote is best-effort; if it failed we don't know the session.
  return 5_000;
}

/**
 * One quote poll for the whole cockpit. The price header and the chart both need the
 * latest print; fetching it twice would double Finnhub/Yahoo usage for no benefit.
 * The chart instead reads this quote to move its last candle, so its live overlay
 * costs zero extra upstream requests.
 *
 * Keyed by `symbol` at the call site, so switching symbols starts from a clean slate
 * rather than briefly painting the previous symbol's price.
 */
export function LiveQuoteProvider({
  symbol,
  children,
}: {
  symbol: string;
  children: ReactNode;
}) {
  const [quote, setQuote] = useState<FinnhubQuote | null>(null);
  const [extended, setExtended] = useState<ExtendedHoursQuote | null>(null);
  const [status, setStatus] = useState<QuoteStatus>("loading");
  const abortRef = useRef<AbortController | null>(null);
  const hasQuoteRef = useRef(false);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`/api/quote?symbol=${encodeURIComponent(symbol)}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const data = (await res.json()) as {
        quote?: FinnhubQuote;
        extended?: ExtendedHoursQuote | null;
        error?: string;
      };
      if (controller.signal.aborted) return;

      if (data.error === "MISSING_API_KEY") {
        setStatus("no_key");
        return;
      }
      if (data.error || !data.quote) {
        // A failed poll must not blank a price that is already on screen; keep the
        // last good quote (and its timestamp) until a later poll succeeds.
        if (!hasQuoteRef.current) setStatus("error");
        return;
      }

      setQuote(data.quote);
      setExtended(data.extended ?? null);
      hasQuoteRef.current = true;
      setStatus("ready");
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      if (!hasQuoteRef.current) setStatus("error");
    }
  }, [symbol]);

  usePoll(load, pollIntervalMs(extended?.session ?? null));

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    []
  );

  const value = useMemo(() => ({ quote, extended, status }), [quote, extended, status]);
  return <LiveQuoteContext.Provider value={value}>{children}</LiveQuoteContext.Provider>;
}

export function useLiveQuote(): LiveQuoteState {
  const value = useContext(LiveQuoteContext);
  if (!value) {
    throw new Error("useLiveQuote must be used inside LiveQuoteProvider");
  }
  return value;
}
