import { NextRequest, NextResponse } from "next/server";
import { deleteLot, updateLot } from "@/lib/position-store";
import { requireAlertsAuth } from "@/lib/alerts-auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauth = await requireAlertsAuth();
  if (unauth) return unauth;
  const { id } = await params;
  const body = (await request.json()) as Partial<{
    symbol: string;
    purchaseDate: number;
    shares: number;
    pricePerShare: number;
  }>;
  if (body.symbol !== undefined) {
    body.symbol = body.symbol.toUpperCase();
  }
  if (body.shares !== undefined && body.shares <= 0) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }
  if (body.pricePerShare !== undefined && body.pricePerShare <= 0) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }
  const lot = await updateLot(id, body);
  if (!lot) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json({ lot });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauth = await requireAlertsAuth();
  if (unauth) return unauth;
  const { id } = await params;
  await deleteLot(id);
  return NextResponse.json({ ok: true });
}
