import { NextResponse } from "next/server";
import { requireAlertsAuth } from "@/lib/alerts-auth";
import { deleteWatchlistItem } from "@/lib/watchlist-store";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const unauth = await requireAlertsAuth();
  if (unauth) return unauth;

  try {
    const { symbol } = await params;
    await deleteWatchlistItem(decodeURIComponent(symbol));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "DB_UNAVAILABLE" }, { status: 503 });
  }
}
