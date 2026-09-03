import { NextRequest, NextResponse } from "next/server";
import { deleteAlert, updateAlert } from "@/lib/alerts-store";
import { requireAlertsAuth } from "@/lib/alerts-auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauth = await requireAlertsAuth();
  if (unauth) return unauth;
  const { id } = await params;
  const body = (await request.json()) as Partial<{
    label: string;
    threshold: number | null;
    active: boolean;
  }>;
  const alert = await updateAlert(id, body);
  if (!alert) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json({ alert });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauth = await requireAlertsAuth();
  if (unauth) return unauth;
  const { id } = await params;
  await deleteAlert(id);
  return NextResponse.json({ ok: true });
}
