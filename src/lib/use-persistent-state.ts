"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

/**
 * `useState` mirrored into localStorage, so the owner's chart workspace — selected
 * timeframe, which indicators are switched on, their periods — survives a reload
 * instead of snapping back to defaults on every visit. This is a daily-use tool for
 * one person; their layout is part of the tool.
 *
 * The stored value is read in an effect rather than during the first render, so the
 * server-rendered markup and the first client render still agree (no hydration
 * mismatch); the restore lands one frame later.
 */
export function usePersistentState<T>(
  key: string,
  initial: T
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(initial);
  const restored = useRef(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage doesn't exist during SSR, so restoring can only happen after mount
        setValue(JSON.parse(raw) as T);
      }
    } catch {
      // unreadable or corrupt entry — keep the default rather than break the page
    }
    restored.current = true;
  }, [key]);

  useEffect(() => {
    // Don't write the default back over a stored value before the restore has run.
    if (!restored.current) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // private mode / quota exceeded — persistence is a convenience, not a requirement
    }
  }, [key, value]);

  return [value, setValue];
}
