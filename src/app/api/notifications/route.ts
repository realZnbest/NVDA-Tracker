import { NextResponse } from "next/server";
import { listNotifications, markNotificationsRead } from "@/lib/alerts-store";

export async function GET() {
  return NextResponse.json({ notifications: await listNotifications() });
}

export async function POST() {
  await markNotificationsRead();
  return NextResponse.json({ ok: true });
}
