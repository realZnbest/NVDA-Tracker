"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Content-box size of an element, kept current through ResizeObserver. The treemap
 * needs the real pixel box to place tiles (a percentage-only layout would distort the
 * squarified aspect ratio); returning 0 until measured keeps the first client render
 * deterministic and SSR-safe.
 */
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const measure = () => {
      setSize((previous) => {
        const width = element.clientWidth;
        const height = element.clientHeight;
        return previous.width === width && previous.height === height
          ? previous
          : { width, height };
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, size] as const;
}
