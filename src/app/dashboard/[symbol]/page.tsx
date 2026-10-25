import { DashboardView } from "@/components/dashboard-view";
import { LiveQuoteProvider } from "@/components/live-quote-provider";

export default async function DashboardSymbolPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol: rawSymbol } = await params;
  const symbol = rawSymbol.toUpperCase();
  return (
    <LiveQuoteProvider key={symbol} symbol={symbol}>
      <DashboardView symbol={symbol} />
    </LiveQuoteProvider>
  );
}
