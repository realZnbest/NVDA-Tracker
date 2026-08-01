import { NextRequest, NextResponse } from "next/server";
import { requireEditSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  return NextResponse.json({ authenticated: requireEditSession(request) });
}
