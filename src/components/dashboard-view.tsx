"use client";

import { useEffect, useState } from "react";
import { usePersistentState } from "@/lib/use-persistent-state";
import { TIMEFRAMES, type TimeframeKey } from "@/lib/timeframes";
import { QuoteHeader } from "@/components/quote-header";
import { WatchlistRail } from "@/components/watchlist-rail";
import { PriceChart } from "@/components/price-chart";
import { AnalysisPanel } from "@/components/analysis-panel";
import { AnalystPanel } from "@/components/analyst-panel";
import { EarningsCountdown } from "@/components/earnings-countdown";
import { BenchmarkChart } from "@/components/benchmark-chart";
import { ChatWidget } from "@/components/chat-widget";

// NVDA keeps its original flat storage key so an existing owner's saved timeframe
// carries over unchanged; every other symbol gets its own key so tab selection
// doesn't bleed across symbols.
function timeframeStorageKey(symbol: string): string {
  return symbol === "NVDA" ? "nvda.chart.timeframe" : `chart.timeframe:${symbol}`;
}

type ChartView = "price" | "compare";
type InspectorTab = "analysis" | "street" | "events";

const INSPECTOR_TABS: { key: InspectorTab; label: string }[] = [
  { key: "analysis", label: "วิเคราะห์" },
  { key: "street", label: "นักวิเคราะห์" },
  { key: "events", label: "เหตุการณ์" },
];

export function DashboardView({ symbol = "NVDA" }: { symbol?: string }) {
  // The selected timeframe drives the chart, the analysis panel and the benchmark chart
  // alike, so it's remembered per browser — reopening the dashboard resumes the window
  // the owner was last working in.
  const [timeframe, setTimeframe] = usePersistentState<TimeframeKey>(
    timeframeStorageKey(symbol),
    "1H"
  );
  const [view, setView] = useState<ChartView>("price");
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("analysis");
  // The comparison chart fetches its own series; mounting it only when first opened keeps
  // the initial dashboard load to one chart's worth of requests, while keeping it alive
  // afterwards so flipping back and forth doesn't refetch.
  const [compareMounted, setCompareMounted] = useState(false);

  useEffect(() => {
    if (view === "compare") setCompareMounted(true);
  }, [view]);

  const activeTimeframe = TIMEFRAMES.find((tf) => tf.key === timeframe);

  return (
    <div className="mx-auto flex w-full flex-col gap-3 px-2 py-2 lg:gap-4 xl:h-full xl:min-h-0">
      <QuoteHeader symbol={symbol} />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-4 xl:min-h-0 xl:flex-1 xl:gap-3 xl:grid-cols-[180px_minmax(0,1fr)_290px]">
        <WatchlistRail symbol={symbol} />

        <section
          className="module flex h-[clamp(480px,calc(100dvh-13rem),880px)] min-h-0 flex-col lg:col-start-2 lg:row-start-1 xl:h-auto"
          aria-label="พื้นที่กราฟ"
        >
          <div className="flex shrink-0 items-center gap-3 border-b border-seam px-3 py-2">
            <div
              role="tablist"
              aria-label="มุมมองกราฟ"
              className="flex shrink-0 items-center rounded-[2px] border border-seam bg-bg/40 p-0.5"
            >
              <ViewTab
                label="กราฟราคา"
                active={view === "price"}
                onClick={() => setView("price")}
              />
              <ViewTab
                label="เทียบตลาด"
                active={view === "compare"}
                onClick={() => setView("compare")}
              />
            </div>

            <div className="h-4 w-px shrink-0 bg-seam" />

            <div className="scrollbar-none flex min-w-0 items-center gap-0.5 overflow-x-auto">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf.key}
                  type="button"
                  onClick={() => setTimeframe(tf.key)}
                  title={tf.label}
                  aria-pressed={timeframe === tf.key}
                  className={`telemetry shrink-0 rounded-[2px] px-1.5 py-1 text-[10px] transition-colors ${
                    timeframe === tf.key
                      ? "bg-ch-price-dim text-ch-price"
                      : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  {tf.key}
                </button>
              ))}
            </div>

            <span className="ml-auto hidden shrink-0 text-[10px] text-text-muted sm:block">
              {activeTimeframe?.label}
            </span>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <div
              className={
                view === "price" ? "flex min-h-0 flex-1 flex-col" : "hidden"
              }
              role="tabpanel"
              aria-label="กราฟราคา"
            >
              <PriceChart symbol={symbol} timeframe={timeframe} />
            </div>
            {compareMounted && (
              <div
                className={
                  view === "compare" ? "flex min-h-0 flex-1 flex-col" : "hidden"
                }
                role="tabpanel"
                aria-label="กราฟเทียบตลาด"
              >
                <BenchmarkChart symbol={symbol} timeframe={timeframe} embedded />
              </div>
            )}
          </div>
        </section>

        <aside
          className="module flex min-h-0 flex-col overflow-hidden lg:col-span-2 xl:col-span-1 xl:col-start-3 xl:row-start-1"
          aria-label="บทวิเคราะห์และเหตุการณ์"
        >
          <div
            role="tablist"
            aria-label="แผงวิเคราะห์"
            className="flex shrink-0 items-stretch border-b border-seam px-1"
          >
            {INSPECTOR_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={inspectorTab === tab.key}
                onClick={() => setInspectorTab(tab.key)}
                className={`relative flex-1 whitespace-nowrap px-2 py-2.5 text-[11px] transition-colors ${
                  inspectorTab === tab.key
                    ? "text-text-primary"
                    : "text-text-muted hover:text-text-secondary"
                }`}
              >
                {tab.label}
                {inspectorTab === tab.key && (
                  <span className="absolute inset-x-2 bottom-0 h-[2px] bg-ch-price" />
                )}
              </button>
            ))}
          </div>

          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto pb-14">
            <div hidden={inspectorTab !== "analysis"} role="tabpanel">
              <AnalysisPanel symbol={symbol} timeframe={timeframe} embedded />
            </div>
            <div hidden={inspectorTab !== "street"} role="tabpanel">
              <AnalystPanel symbol={symbol} embedded />
            </div>
            <div hidden={inspectorTab !== "events"} role="tabpanel">
              <EarningsCountdown symbol={symbol} embedded />
            </div>
          </div>
        </aside>
      </div>

      <ChatWidget symbol={symbol} />
    </div>
  );
}

function ViewTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-[1px] px-2.5 py-1 text-[11px] transition-colors ${
        active
          ? "bg-panel-2 text-text-primary"
          : "text-text-muted hover:text-text-secondary"
      }`}
    >
      {label}
    </button>
  );
}
