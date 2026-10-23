import { NextRequest, NextResponse } from "next/server";
import { requireAlertsAuth } from "@/lib/alerts-auth";
import {
  addWatchlistItem,
  listWatchlist,
  reorderWatchlist,
  WatchlistError,
} from "@/lib/watchlist-store";

function dbUnavailable() {
  return NextResponse.json({ error: "DB_UNAVAILABLE" }, { status: 503 });
}

export async function GET() {
  const unauth = await requireAlertsAuth();
  if (unauth) return unauth;
  try {
    return NextResponse.json({ items: await listWatchlist() });
  } catch {
    return dbUnavailable();
  }
}

export async function POST(request: NextRequest) {
  const unauth = await requireAlertsAuth();
  if (unauth) return unauth;

  let body: { symbol?: string; name?: string };
  try {
    body = (await request.json()) as { symbol?: string; name?: string };
  } catch {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }
  if (!body.symbol || typeof body.symbol !== "string") {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  try {
    const item = await addWatchlistItem({
      symbol: body.symbol,
      name: typeof body.name === "string" ? body.name : undefined,
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    if (err instanceof WatchlistError) {
      return NextResponse.json({ error: err.code }, { status: 400 });
    }
    return dbUnavailable();
  }
}

export async function PATCH(request: NextRequest) {
  const unauth = await requireAlertsAuth();
  if (unauth) return unauth;

  let body: { symbols?: unknown };
  try {
    body = (await request.json()) as { symbols?: unknown };
  } catch {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }
  if (!Array.isArray(body.symbols) || !body.symbols.every((s) => typeof s === "string")) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  try {
    return NextResponse.json({ items: await reorderWatchlist(body.symbols as string[]) });
  } catch {
    return dbUnavailable();
  }
}
