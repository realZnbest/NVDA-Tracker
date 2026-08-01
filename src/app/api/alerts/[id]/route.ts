import { NextRequest, NextResponse } from "next/server";
import { deleteAlert, updateAlert } from "@/lib/alerts-store";

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/alerts/[id]">
) {
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
  _request: NextRequest,
  ctx: RouteContext<"/api/alerts/[id]">
) {
  const { id } = await ctx.params;
  deleteAlert(id);
  return NextResponse.json({ ok: true });
}
