"use client";

import { useEffect, useRef } from "react";

/**
 * Runs `callback` on an interval, but only while the tab is actually visible — a
 * backgrounded tab otherwise burns Finnhub/Yahoo rate limit refreshing numbers
 * nobody is looking at. Coming back to the tab fires the callback immediately
 * rather than waiting out the remainder of the interval, so what the owner sees
 * on return is fresh, not up to `intervalMs` stale.
 *
 * `callback` may change identity between renders without restarting the timer.
 *
 * Pass `leading: false` when the caller already loads once on mount — the poll then
 * waits out a full interval before its first tick, but still refreshes immediately
 * when the tab is re-focused, so mounting doesn't fire two identical requests.
 */
export function usePoll(
  callback: () => void,
  intervalMs: number,
  { enabled = true, leading = true }: { enabled?: boolean; leading?: boolean } = {}
) {
  const savedRef = useRef(callback);

  useEffect(() => {
    savedRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setInterval> | null = null;
    let firstStart = true;
    const run = () => savedRef.current();

    const start = () => {
      if (timer !== null) return;
      if (leading || !firstStart) run();
      firstStart = false;
      timer = setInterval(run, intervalMs);
    };
    const stop = () => {
      if (timer === null) return;
      clearInterval(timer);
      timer = null;
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") start();
      else stop();
    };

    onVisibilityChange();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [intervalMs, enabled, leading]);
}
