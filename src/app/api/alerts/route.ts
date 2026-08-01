import { NextRequest, NextResponse } from "next/server";
import { createAlert, listAlerts } from "@/lib/alerts-store";
import { requireEditSession } from "@/lib/auth";
import type { AlertType } from "@/lib/types";

export async function GET() {
  return NextResponse.json({ alerts: listAlerts() });
}

export async function POST(request: NextRequest) {
  if (!requireEditSession(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

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

  const alert = createAlert(body);
  return NextResponse.json({ alert }, { status: 201 });
}
