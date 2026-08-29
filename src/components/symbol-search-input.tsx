"use client";

import { useEffect, useRef, useState } from "react";
import { IconSearch } from "./icons";

export interface SymbolSearchResult {
  symbol: string;
  description: string;
}

const DEBOUNCE_MS = 300;

interface SymbolSearchInputProps {
  value: string;
  onChange: (text: string) => void;
  onSelect: (result: SymbolSearchResult) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  autoFocus?: boolean;
}

/**
 * Combobox over /api/symbol-search. Fully controlled — the parent owns `value` — so
 * every call site can decide what happens to the text after a selection: replaced with
 * the picked symbol and left for the rest of the form (alerts), or immediately consumed
 * to navigate elsewhere (nav bar, portfolio overview).
 */
export function SymbolSearchInput({
  value,
  onChange,
  onSelect,
  placeholder = "ค้นหาหุ้น เช่น AAPL หรือ Apple",
  className,
  inputClassName,
  autoFocus,
}: SymbolSearchInputProps) {
  const [results, setResults] = useState<SymbolSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || value.trim().length < 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear stale results when the query is cleared or the dropdown closes
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      fetch(`/api/symbol-search?q=${encodeURIComponent(value.trim())}`)
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return;
          setResults(data.results ?? []);
          setHighlighted(0);
        })
        .catch(() => !cancelled && setResults([]))
        .finally(() => !cancelled && setLoading(false));
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value, open]);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function pick(result: SymbolSearchResult) {
    setOpen(false);
    setResults([]);
    onSelect(result);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(results[highlighted]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showDropdown = open && value.trim().length >= 1;

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <div className="relative">
        <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          lang="en"
          autoCapitalize="characters"
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={
            inputClassName ??
            "telemetry w-full rounded border border-seam bg-panel-2 py-1.5 pl-8 pr-2 text-sm text-text-primary"
          }
        />
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded border border-seam bg-bg-raised shadow-lg">
          {loading ? (
            <p className="px-3 py-2.5 text-sm text-text-muted">กำลังค้นหา…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-text-muted">ไม่พบผลลัพธ์</p>
          ) : (
            <ul>
              {results.map((r, i) => (
                <li key={r.symbol}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(r)}
                    onMouseEnter={() => setHighlighted(i)}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors ${
                      i === highlighted ? "bg-white/[0.06] text-text-primary" : "text-text-secondary"
                    }`}
                  >
                    <span className="truncate">{r.description}</span>
                    <span className="telemetry shrink-0 text-[0.6875rem] text-ch-price">{r.symbol}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
