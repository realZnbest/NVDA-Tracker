"use client";

import type { MarketSession } from "@/lib/types";

const SESSION_BADGE: Record<
  MarketSession,
  { label: string; color: string; pulse: boolean; title: string }
> = {
  regular: {
    label: "LIVE",
    color: "var(--up)",
    pulse: true,
    title: "ตลาดสหรัฐฯ เปิดทำการ",
  },
  pre: {
    label: "PRE",
    color: "#e3a94b",
    pulse: false,
    title: "ก่อนตลาดเปิด",
  },
  post: {
    label: "AH",
    color: "#e3a94b",
    pulse: false,
    title: "หลังตลาดปิด",
  },
  closed: {
    label: "CLOSED",
    color: "var(--text-muted)",
    pulse: false,
    title: "ตลาดปิด",
  },
};

/** The LIVE/PRE/AH/CLOSED annunciator shared by the watchlist and the market map, so
 *  a session always looks the same wherever it is reported. */
export function SessionBadge({
  session,
  className = "",
}: {
  session: MarketSession | null;
  className?: string;
}) {
  if (!session) return null;
  const config = SESSION_BADGE[session];

  return (
    <span
      title={config.title}
      className={`inline-flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-0.5 text-[0.5625rem] font-semibold tracking-[0.08em] ${className}`}
      style={{
        color: config.color,
        backgroundColor: `color-mix(in srgb, ${config.color} 14%, transparent)`,
      }}
    >
      <span
        aria-hidden="true"
        className={`h-1 w-1 rounded-full ${
          config.pulse ? "animate-[lit-pulse_2s_ease-in-out_infinite]" : ""
        }`}
        style={{ backgroundColor: config.color }}
      />
      {config.label}
    </span>
  );
}
