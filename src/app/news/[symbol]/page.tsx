import { NewsPageView } from "@/components/news-page-view";

export default async function NewsSymbolPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol: rawSymbol } = await params;
  return <NewsPageView symbol={rawSymbol.toUpperCase()} />;
}
