import { QuoteHeader } from "@/components/quote-header";
import { PriceChart } from "@/components/price-chart";
import { AnalysisPanel } from "@/components/analysis-panel";
import { AnalystPanel } from "@/components/analyst-panel";
import { EarningsCountdown } from "@/components/earnings-countdown";

export default function DashboardPage() {
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4 p-4">
      <QuoteHeader />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        <PriceChart />
        <div className="flex flex-col gap-4">
          <AnalysisPanel />
          <AnalystPanel />
          <EarningsCountdown />
        </div>
      </div>
    </div>
  );
}
