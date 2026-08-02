import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  ALERTS_AUTH_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  checkPassword,
  createSessionToken,
  isAlertsAuthorized,
  isAlertsConfigured,
} from "@/lib/alerts-auth";

export async function GET() {
  return NextResponse.json({
    authenticated: await isAlertsAuthorized(),
    configured: isAlertsConfigured(),
  });
}

export async function POST(request: NextRequest) {
  if (!isAlertsConfigured()) {
    return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503 });
  }
  const body = (await request.json()) as { password?: string };
  if (!body.password || !checkPassword(body.password)) {
    return NextResponse.json({ error: "INVALID_PASSWORD" }, { status: 401 });
  }
  const store = await cookies();
  store.set(ALERTS_AUTH_COOKIE, createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const store = await cookies();
  store.delete(ALERTS_AUTH_COOKIE);
  return NextResponse.json({ ok: true });
}
