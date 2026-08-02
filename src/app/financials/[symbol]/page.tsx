import { FinancialsPageView } from "@/components/financials-page-view";

export default async function FinancialsSymbolPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol: rawSymbol } = await params;
  return <FinancialsPageView symbol={rawSymbol.toUpperCase()} />;
}
