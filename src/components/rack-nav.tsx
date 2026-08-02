"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { IconBell, IconLedger, IconSignal, IconWallet, IconWave } from "./icons";
import { NotificationBell } from "./notification-bell";
import { SymbolSearchInput, type SymbolSearchResult } from "./symbol-search-input";

const NAV_ITEMS = [
  { href: "/dashboard", label: "ราคา / แนวโน้ม", icon: IconWave },
  { href: "/financials", label: "งบการเงิน", icon: IconLedger },
  { href: "/news", label: "ข่าว", icon: IconSignal },
  { href: "/portfolio", label: "พอร์ตของฉัน", icon: IconWallet },
  { href: "/alerts", label: "การแจ้งเตือน", icon: IconBell },
] as const;

export function RackNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSelect(result: SymbolSearchResult) {
    setQuery("");
    router.push(`/dashboard/${result.symbol}`);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-seam bg-bg-raised/95 backdrop-blur">
      <nav className="flex items-center px-2">
        <div className="flex items-center overflow-x-auto scrollbar-thin">
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
        </div>

        <SymbolSearchInput
          value={query}
          onChange={setQuery}
          onSelect={handleSelect}
          placeholder="ค้นหาหุ้น…"
          className="ml-auto hidden sm:block w-56 shrink-0"
          inputClassName="telemetry w-full rounded border border-seam bg-panel-2 py-1.5 pl-8 pr-2 text-xs text-text-primary"
        />

        <NotificationBell className="hidden sm:block pl-2" />
      </nav>
    </header>
  );
}
