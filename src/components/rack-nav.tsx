"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { IconBell, IconLedger, IconSignal, IconWave } from "./icons";
import { useAlertsContext } from "./alerts-provider";

const NAV_ITEMS = [
  { href: "/dashboard", label: "ราคา / แนวโน้ม", icon: IconWave },
  { href: "/financials", label: "งบการเงิน", icon: IconLedger },
  { href: "/news", label: "ข่าว", icon: IconSignal },
  { href: "/alerts", label: "การแจ้งเตือน", icon: IconBell },
] as const;

const LAMPS = [
  { key: "ราคา", label: "PRICE", color: "var(--ch-price)" },
  { key: "RSI", label: "RSI", color: "var(--ch-rsi)" },
  { key: "MACD", label: "MACD", color: "var(--ch-macd)" },
  { key: "Cross", label: "MA", color: "var(--ch-volume)" },
] as const;

export function RackNav() {
  const pathname = usePathname();
  const { notifications, unreadCount, markRead } = useAlertsContext();
  const [open, setOpen] = useState(false);

  const unread = useMemo(() => notifications.filter((n) => !n.readAt), [notifications]);

  const lampLit = (key: string) => unread.some((n) => n.message.includes(key));

  return (
    <header className="sticky top-0 z-40 border-b border-seam bg-bg-raised/95 backdrop-blur">
      {/* annunciator strip */}
      <div className="flex items-center gap-4 border-b border-seam/60 px-4 py-1.5">
        <span className="module-label text-[9px] text-text-muted">แผงสัญญาณ</span>
        <div className="flex items-center gap-3">
          {LAMPS.map((lamp) => {
            const lit = lampLit(lamp.key);
            return (
              <span key={lamp.key} className="flex items-center gap-1.5" title={lamp.label}>
                <span
                  className={`h-1.5 w-1.5 rounded-full ${lit ? "lit" : ""}`}
                  style={{
                    background: lit ? lamp.color : "var(--seam-bright)",
                    boxShadow: lit ? `0 0 6px ${lamp.color}` : "none",
                  }}
                />
                <span className="telemetry text-[9px] text-text-muted">{lamp.label}</span>
              </span>
            );
          })}
        </div>
        <div className="ml-auto relative">
          <button
            onClick={() => {
              setOpen((v) => !v);
              if (!open) markRead();
            }}
            className="flex items-center gap-1.5 rounded px-1.5 py-0.5 text-text-secondary hover:text-text-primary transition-colors"
            aria-label="การแจ้งเตือน"
          >
            <IconBell className="h-3.5 w-3.5" />
            {unreadCount > 0 && (
              <span className="telemetry rounded-full bg-ch-alert px-1 text-[9px] leading-4 text-bg">
                {unreadCount}
              </span>
            )}
          </button>
          {open && (
            <div className="absolute right-0 top-8 w-80 module scrollbar-thin max-h-96 overflow-y-auto p-3">
              <div className="module-label mb-2">บันทึกการแจ้งเตือนล่าสุด</div>
              {notifications.length === 0 ? (
                <p className="text-xs text-text-muted py-4 text-center">
                  ยังไม่มีการแจ้งเตือนที่ทริกเกอร์
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {notifications.map((n) => (
                    <li key={n.id} className="border-t border-seam/60 pt-2 first:border-t-0 first:pt-0">
                      <p className="text-xs text-text-primary leading-relaxed">{n.message}</p>
                      <p className="telemetry text-[10px] text-text-muted mt-1">
                        {new Date(n.createdAt).toLocaleString("th-TH")}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      {/* module tabs */}
      <nav className="flex items-center overflow-x-auto scrollbar-thin px-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname?.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex shrink-0 items-center gap-2 whitespace-nowrap px-4 py-3 text-sm border-b-2 transition-colors ${
                active
                  ? "border-ch-price text-text-primary"
                  : "border-transparent text-text-secondary hover:text-text-primary"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
        <span className="ml-auto pr-4 telemetry text-[10px] text-text-muted hidden sm:block">
          NVDA · NASDAQ
        </span>
      </nav>
    </header>
  );
}
