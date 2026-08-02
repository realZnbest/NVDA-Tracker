import { FinancialsView } from "@/components/financials-view";
import { AiSummaryCard } from "@/components/ai-summary-card";

export function FinancialsPageView({ symbol = "NVDA" }: { symbol?: string }) {
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4 p-4">
      <h1 className="text-lg font-medium text-text-primary">งบการเงิน {symbol}</h1>
      <AiSummaryCard type="financials" symbol={symbol} />
      <FinancialsView symbol={symbol} />
    </div>
  );
}
