import Link from "next/link";
import { PositionPanel } from "@/components/position-panel";
import { PnlProjectionPanel } from "@/components/pnl-projection";

export default async function PortfolioSymbolPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol: rawSymbol } = await params;
  const symbol = rawSymbol.toUpperCase();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <Link href="/portfolio" className="text-sm text-text-muted hover:text-text-primary transition-colors">
          พอร์ตของฉัน
        </Link>
        <span className="text-sm text-text-muted">/</span>
        <h1 className="text-lg font-medium text-text-primary">{symbol}</h1>
      </div>
      <PositionPanel symbol={symbol} />
      <PnlProjectionPanel symbol={symbol} />
    </div>
  );
}
