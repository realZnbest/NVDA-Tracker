"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SymbolSearchInput, type SymbolSearchResult } from "@/components/symbol-search-input";
import { IconWave } from "@/components/icons";

export default function Home() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSelect(result: SymbolSearchResult) {
    router.push(`/dashboard/${result.symbol}`);
  }

  return (
    <div className="flex min-h-[calc(100dvh-3rem)] flex-col items-center justify-center px-4">
      <div className="flex flex-col items-center gap-6">
        <IconWave className="h-10 w-10 text-ch-price" />

        <div className="flex flex-col items-center gap-1">
          <h1 className="text-display-headline font-medium text-text-primary tracking-tight">
            Stock Tracker
          </h1>
          <p className="text-sm text-text-muted">
            ค้นหาหุ้นตัวไหนก็ได้เพื่อดูข้อมูล
          </p>
        </div>

        <SymbolSearchInput
          value={query}
          onChange={setQuery}
          onSelect={handleSelect}
          placeholder="ค้นหาหุ้น เช่น NVDA, AAPL"
          autoFocus
          className="w-full max-w-[640px] sm:max-w-[900px] focus:outline-none focus:ring-0 focus:border-seam-bright"
          inputClassName="telemetry w-full rounded border border-seam bg-panel-2 py-3 pl-10 pr-4 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-0 focus:border-seam-bright"
        />
      </div>
    </div>
  );
}
