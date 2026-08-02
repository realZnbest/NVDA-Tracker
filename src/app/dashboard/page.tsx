"use client";

import { useState } from "react";
import { QuoteHeader } from "@/components/quote-header";
import { PriceChart } from "@/components/price-chart";
import { AnalysisPanel } from "@/components/analysis-panel";
import { AnalystPanel } from "@/components/analyst-panel";
import { EarningsCountdown } from "@/components/earnings-countdown";
import { BenchmarkChart } from "@/components/benchmark-chart";
import { ChatWidget } from "@/components/chat-widget";
import type { TimeframeKey } from "@/lib/timeframes";

export default function DashboardPage() {
  const [timeframe, setTimeframe] = useState<TimeframeKey>("1H");

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4 p-4">
      <QuoteHeader />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        <PriceChart timeframe={timeframe} onTimeframeChange={setTimeframe} />
        <div className="flex flex-col gap-4">
          <AnalysisPanel timeframe={timeframe} />
          <AnalystPanel />
          <EarningsCountdown />
        </div>
      </div>
      <BenchmarkChart timeframe={timeframe} />
      <ChatWidget />
    </div>
  );
}
