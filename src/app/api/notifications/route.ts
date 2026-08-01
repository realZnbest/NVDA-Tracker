import { NextResponse } from "next/server";
import { listNotifications, markNotificationsRead } from "@/lib/alerts-store";

export async function GET() {
  return NextResponse.json({ notifications: listNotifications() });
}

export async function POST() {
  markNotificationsRead();
  return NextResponse.json({ ok: true });
}
