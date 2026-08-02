"use client";

import { usePersistentState } from "@/lib/use-persistent-state";
import { QuoteHeader } from "@/components/quote-header";
import { PriceChart } from "@/components/price-chart";
import { AnalysisPanel } from "@/components/analysis-panel";
import { AnalystPanel } from "@/components/analyst-panel";
import { EarningsCountdown } from "@/components/earnings-countdown";
import { BenchmarkChart } from "@/components/benchmark-chart";
import { ChatWidget } from "@/components/chat-widget";
import type { TimeframeKey } from "@/lib/timeframes";

// NVDA keeps its original flat storage key so an existing owner's saved timeframe
// carries over unchanged; every other symbol gets its own key so tab selection
// doesn't bleed across symbols.
function timeframeStorageKey(symbol: string): string {
  return symbol === "NVDA" ? "nvda.chart.timeframe" : `chart.timeframe:${symbol}`;
}

export function DashboardView({ symbol = "NVDA" }: { symbol?: string }) {
  // The selected timeframe drives the chart, the analysis panel and the benchmark chart
  // alike, so it's remembered per browser — reopening the dashboard resumes the window
  // the owner was last working in.
  const [timeframe, setTimeframe] = usePersistentState<TimeframeKey>(
    timeframeStorageKey(symbol),
    "1H"
  );

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4 p-4">
      <QuoteHeader symbol={symbol} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        <PriceChart symbol={symbol} timeframe={timeframe} onTimeframeChange={setTimeframe} />
        <div className="flex flex-col gap-4">
          <AnalysisPanel symbol={symbol} timeframe={timeframe} />
          <AnalystPanel symbol={symbol} />
          <EarningsCountdown symbol={symbol} />
        </div>
      </div>
      <BenchmarkChart symbol={symbol} timeframe={timeframe} />
      <ChatWidget symbol={symbol} />
    </div>
  );
}
