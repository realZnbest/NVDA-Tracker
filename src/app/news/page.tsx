import { NewsList } from "@/components/news-list";
import { AiSummaryCard } from "@/components/ai-summary-card";

export default function NewsPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <h1 className="text-lg font-medium text-text-primary">ข่าว NVIDIA</h1>
      <AiSummaryCard type="news" />
      <div className="module px-4">
        <NewsList />
      </div>
    </div>
  );
}
