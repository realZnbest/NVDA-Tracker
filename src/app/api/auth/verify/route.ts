import { NextRequest, NextResponse } from "next/server";
import { EDIT_SESSION_COOKIE, consumeMagicLink, createEditSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token || !consumeMagicLink(token)) {
    return NextResponse.redirect(new URL("/dashboard?edit=invalid", request.url));
  }

  const session = createEditSession();
  const res = NextResponse.redirect(new URL("/dashboard?edit=ok", request.url));
  res.cookies.set(EDIT_SESSION_COOKIE, session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: new Date(session.expiresAt),
    path: "/",
  });
  return res;
}
