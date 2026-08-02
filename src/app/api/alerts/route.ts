import { NextRequest, NextResponse } from "next/server";
import { createAlert, listAlerts } from "@/lib/alerts-store";
import { requireAlertsAuth } from "@/lib/alerts-auth";
import type { AlertType } from "@/lib/types";

export async function GET() {
  const unauth = await requireAlertsAuth();
  if (unauth) return unauth;
  return NextResponse.json({ alerts: await listAlerts() });
}

export async function POST(request: NextRequest) {
  const unauth = await requireAlertsAuth();
  if (unauth) return unauth;
  const body = (await request.json()) as {
    type: AlertType;
    label: string;
    threshold?: number | null;
    fastPeriod?: number | null;
    slowPeriod?: number | null;
  };

  if (!body.type || !body.label) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const alert = await createAlert(body);
  return NextResponse.json({ alert }, { status: 201 });
}
