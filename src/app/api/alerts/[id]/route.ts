import { NextRequest, NextResponse } from "next/server";
import { deleteAlert, updateAlert } from "@/lib/alerts-store";
import { requireEditSession } from "@/lib/auth";

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/alerts/[id]">
) {
  if (!requireEditSession(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = (await request.json()) as Partial<{
    label: string;
    threshold: number | null;
    active: boolean;
  }>;
  const alert = updateAlert(id, body);
  if (!alert) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json({ alert });
}

export async function DELETE(
  request: NextRequest,
  ctx: RouteContext<"/api/alerts/[id]">
) {
  if (!requireEditSession(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const { id } = await ctx.params;
  deleteAlert(id);
  return NextResponse.json({ ok: true });
}
