"use client";

import { useState } from "react";

/**
 * Brand mark for a ticker, with a monogram fallback so a missing logo never leaves a
 * hole in a dense rail or header. Brand images come from Parqet's public symbol-logo
 * endpoint (same source the watchlist page already uses) and are decorative — the
 * ticker text beside them carries the meaning.
 */
export function TickerLogo({
  symbol,
  className = "h-9 w-9",
  textClassName = "text-[11px]",
}: {
  symbol: string;
  className?: string;
  textClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  const monogram = symbol.replace(/^\^/, "").replace(/[^A-Za-z0-9]/g, "").slice(0, 1) || "?";

  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-[3px] bg-panel-2 ring-1 ring-white/10 ${className}`}
      aria-hidden="true"
    >
      {failed ? (
        <span className={`telemetry font-semibold text-text-secondary ${textClassName}`}>
          {monogram}
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://assets.parqet.com/logos/symbol/${encodeURIComponent(symbol)}?format=png`}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
