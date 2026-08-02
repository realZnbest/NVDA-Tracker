import { NextRequest, NextResponse } from "next/server";
import { addLot, listLots } from "@/lib/position-store";
import { computeAggregatePosition, computeAggregatePositionsBySymbol } from "@/lib/position";
import { requireAlertsAuth } from "@/lib/alerts-auth";

export async function GET(request: NextRequest) {
  const unauth = await requireAlertsAuth();
  if (unauth) return unauth;
  const symbol = request.nextUrl.searchParams.get("symbol") ?? undefined;
  const lots = await listLots(symbol);
  if (symbol) {
    return NextResponse.json({ lots, aggregate: computeAggregatePosition(lots) });
  }
  // No symbol filter: overview mode — group lots by symbol and aggregate each independently.
  const bySymbol = computeAggregatePositionsBySymbol(lots);
  return NextResponse.json({
    lots,
    aggregates: Object.fromEntries(bySymbol),
  });
}

export async function POST(request: NextRequest) {
  const unauth = await requireAlertsAuth();
  if (unauth) return unauth;
  const body = (await request.json()) as {
    symbol?: string;
    purchaseDate?: number;
    shares?: number;
    pricePerShare?: number;
  };
  if (
    !body.symbol ||
    !body.purchaseDate ||
    !body.shares ||
    body.shares <= 0 ||
    !body.pricePerShare ||
    body.pricePerShare <= 0
  ) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }
  const lot = await addLot({
    symbol: body.symbol.toUpperCase(),
    purchaseDate: body.purchaseDate,
    shares: body.shares,
    pricePerShare: body.pricePerShare,
  });
  return NextResponse.json({ lot }, { status: 201 });
}
