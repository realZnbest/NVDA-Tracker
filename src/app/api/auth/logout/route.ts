import { NextRequest, NextResponse } from "next/server";
import { EDIT_SESSION_COOKIE, destroyEditSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(EDIT_SESSION_COOKIE)?.value;
  if (token) destroyEditSession(token);
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(EDIT_SESSION_COOKIE);
  return res;
}
