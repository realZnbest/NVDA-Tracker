import { NextRequest, NextResponse } from "next/server";
import { addLot, listLots } from "@/lib/position-store";
import { computeAggregatePosition } from "@/lib/position";
import { requireAlertsAuth } from "@/lib/alerts-auth";

export async function GET() {
  const unauth = await requireAlertsAuth();
  if (unauth) return unauth;
  const lots = await listLots();
  return NextResponse.json({ lots, aggregate: computeAggregatePosition(lots) });
}

export async function POST(request: NextRequest) {
  const unauth = await requireAlertsAuth();
  if (unauth) return unauth;
  const body = (await request.json()) as {
    purchaseDate?: number;
    shares?: number;
    pricePerShare?: number;
  };
  if (!body.purchaseDate || !body.shares || body.shares <= 0 || !body.pricePerShare || body.pricePerShare <= 0) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }
  const lot = await addLot({
    purchaseDate: body.purchaseDate,
    shares: body.shares,
    pricePerShare: body.pricePerShare,
  });
  return NextResponse.json({ lot }, { status: 201 });
}
