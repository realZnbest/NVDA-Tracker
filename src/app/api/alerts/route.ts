import { NextRequest, NextResponse } from "next/server";
import { createAlert, listAlerts } from "@/lib/alerts-store";
import { requireAlertsAuth } from "@/lib/alerts-auth";
import { PORTFOLIO_ALERT_TYPES, type AlertType } from "@/lib/types";

export async function GET(request: NextRequest) {
  const unauth = await requireAlertsAuth();
  if (unauth) return unauth;
  const symbol = request.nextUrl.searchParams.get("symbol") ?? undefined;
  return NextResponse.json({ alerts: await listAlerts(symbol) });
}

export async function POST(request: NextRequest) {
  const unauth = await requireAlertsAuth();
  if (unauth) return unauth;
  const body = (await request.json()) as {
    type: AlertType;
    label: string;
    symbol?: string | null;
    threshold?: number | null;
    fastPeriod?: number | null;
    slowPeriod?: number | null;
  };

  if (!body.type || !body.label) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }
  if (!PORTFOLIO_ALERT_TYPES.includes(body.type) && !body.symbol) {
    return NextResponse.json({ error: "SYMBOL_REQUIRED" }, { status: 400 });
  }

  const alert = await createAlert(body);
  return NextResponse.json({ alert }, { status: 201 });
}
