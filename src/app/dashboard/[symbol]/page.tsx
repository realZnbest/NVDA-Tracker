import { DashboardView } from "@/components/dashboard-view";

export default async function DashboardSymbolPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol: rawSymbol } = await params;
  return <DashboardView symbol={rawSymbol.toUpperCase()} />;
}
