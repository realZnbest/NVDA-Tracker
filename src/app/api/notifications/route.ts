import { NextResponse } from "next/server";
import { listNotifications, markNotificationsRead } from "@/lib/alerts-store";
import { requireAlertsAuth } from "@/lib/alerts-auth";

export async function GET() {
  const unauth = await requireAlertsAuth();
  if (unauth) return unauth;
  return NextResponse.json({ notifications: await listNotifications() });
}

export async function POST() {
  const unauth = await requireAlertsAuth();
  if (unauth) return unauth;
  await markNotificationsRead();
  return NextResponse.json({ ok: true });
}
