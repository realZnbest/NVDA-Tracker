import { NextRequest, NextResponse } from "next/server";
import { requireEditSession } from "@/lib/auth";
import { getPosition, upsertPosition } from "@/lib/position-store";

export async function GET() {
  return NextResponse.json({ position: getPosition() });
}

export async function PUT(request: NextRequest) {
  if (!requireEditSession(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = (await request.json()) as { avgCost?: number; shares?: number; startDate?: number };
  if (
    typeof body.avgCost !== "number" ||
    body.avgCost <= 0 ||
    typeof body.shares !== "number" ||
    body.shares <= 0 ||
    typeof body.startDate !== "number"
  ) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const position = upsertPosition({
    avgCost: body.avgCost,
    shares: body.shares,
    startDate: body.startDate,
  });
  return NextResponse.json({ position });
}
