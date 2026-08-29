import { NewsList } from "@/components/news-list";
import { AiSummaryCard } from "@/components/ai-summary-card";

export function NewsPageView({ symbol = "NVDA" }: { symbol?: string }) {
  return (
    <div className="page-container-reading flex flex-col gap-4">
      <h1 className="text-display-headline font-medium text-text-primary">ข่าว {symbol}</h1>
      <AiSummaryCard type="news" symbol={symbol} />
      <div className="module px-4">
        <NewsList symbol={symbol} />
      </div>
    </div>
  );
}
