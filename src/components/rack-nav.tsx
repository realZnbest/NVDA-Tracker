"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useParams, useRouter } from "next/navigation";
import { IconBell, IconLedger, IconSignal, IconWallet, IconWave } from "./icons";
import { NotificationBell } from "./notification-bell";
import { SymbolSearchInput, type SymbolSearchResult } from "./symbol-search-input";

// Only /financials and /news have a symbol-aware href — they get their own /[symbol]
// route segment, so the nav link should follow whatever symbol the user is currently
// looking at instead of always bouncing back to the bare (NVDA) route.
const NAV_ITEMS = [
  { href: "/dashboard", label: "ราคา / แนวโน้ม", icon: IconWave, symbolAware: false },
  { href: "/financials", label: "งบการเงิน", icon: IconLedger, symbolAware: true },
  { href: "/news", label: "ข่าว", icon: IconSignal, symbolAware: true },
  { href: "/portfolio", label: "พอร์ตของฉัน", icon: IconWallet, symbolAware: false },
  { href: "/alerts", label: "การแจ้งเตือน", icon: IconBell, symbolAware: false },
] as const;

const LAST_SYMBOL_KEY = "nvda-tracker.last-symbol";

export function RackNav() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams<{ symbol?: string }>();
  const urlSymbol = params?.symbol;
  // /portfolio and /alerts have no [symbol] segment, so urlSymbol goes undefined while
  // viewing them — that must NOT erase which symbol the user was last looking at on
  // Dashboard/News/Financials. Track it separately, backed by localStorage so it also
  // survives a full page reload, not just client-side navigation.
  const [lastSymbol, setLastSymbol] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (urlSymbol) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mirror the URL's symbol into cross-page state
      setLastSymbol(urlSymbol);
      localStorage.setItem(LAST_SYMBOL_KEY, urlSymbol);
    } else if (lastSymbol === undefined) {
      const stored = localStorage.getItem(LAST_SYMBOL_KEY);
      if (stored) setLastSymbol(stored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to URL symbol changes; lastSymbol is read, not a trigger
  }, [urlSymbol]);

  const activeSymbol = urlSymbol ?? lastSymbol;
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
            const href = item.symbolAware && activeSymbol ? `${item.href}/${activeSymbol}` : item.href;
            return (
              <Link
                key={item.href}
                href={href}
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
