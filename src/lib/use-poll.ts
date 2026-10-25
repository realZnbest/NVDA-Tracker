"use client";

import { useEffect, useRef } from "react";

type PollCallback = () => void | Promise<unknown>;

/**
 * Runs `callback` on an interval, but only while the tab is actually visible — a
 * backgrounded tab otherwise burns Finnhub/Yahoo rate limit refreshing numbers
 * nobody is looking at. Coming back to the tab fires the callback immediately
 * rather than waiting out the remainder of the interval, so what the owner sees
 * on return is fresh, not up to `intervalMs` stale.
 *
 * `callback` may change identity between renders without restarting the timer.
 * If it returns a promise, the next tick is skipped while that promise is still
 * pending. Without this guard a slow provider call (or a cold API route) could
 * stack two requests, and the older response could land last and overwrite the
 * newer one. A hung request releases the guard after a bounded timeout so the
 * poll cannot stop forever.
 *
 * Pass `leading: false` when the caller already loads once on mount — the poll then
 * waits out a full interval before its first tick, but still refreshes immediately
 * when the tab is re-focused, so mounting doesn't fire two identical requests.
 */
export function usePoll(
  callback: PollCallback,
  intervalMs: number,
  { enabled = true, leading = true }: { enabled?: boolean; leading?: boolean } = {}
) {
  const savedRef = useRef<PollCallback>(callback);
  /** Token for the request currently in flight, or null when idle. A token rather
   *  than a boolean so a released older request cannot clear a newer run's guard. */
  const inFlightRef = useRef<object | null>(null);

  useEffect(() => {
    savedRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setInterval> | null = null;
    let firstStart = true;

    const run = () => {
      if (inFlightRef.current) return;

      const result = savedRef.current();
      if (!result || typeof (result as Promise<unknown>).then !== "function") return;

      const token = {};
      inFlightRef.current = token;
      let releaseTimer: ReturnType<typeof setTimeout> | null = null;
      const release = () => {
        if (releaseTimer !== null) {
          clearTimeout(releaseTimer);
          releaseTimer = null;
        }
        if (inFlightRef.current === token) inFlightRef.current = null;
      };
      // Safety valve: a request that never settles must not freeze polling forever.
      releaseTimer = setTimeout(release, Math.max(intervalMs * 4, 20_000));
      void (result as Promise<unknown>).then(release, release);
    };

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
