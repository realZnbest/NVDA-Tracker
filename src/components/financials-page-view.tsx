import { FinancialsView } from "@/components/financials-view";
import { AiSummaryCard } from "@/components/ai-summary-card";

export function FinancialsPageView({ symbol = "NVDA" }: { symbol?: string }) {
  return (
    <div className="page-container flex flex-col gap-4">
      <h1 className="text-display-headline font-medium text-text-primary">งบการเงิน {symbol}</h1>
      <AiSummaryCard type="financials" symbol={symbol} />
      <FinancialsView symbol={symbol} />
    </div>
  );
}
