import { NextRequest, NextResponse } from "next/server";
import { createMagicLink } from "@/lib/auth";
import { sendEmail } from "@/lib/email";

const MIN_INTERVAL_MS = 60_000;
let lastRequestAt = 0;

export async function POST(request: NextRequest) {
  const ownerEmail = process.env.OWNER_EMAIL;
  if (!ownerEmail) {
    return NextResponse.json({ error: "MISSING_OWNER_EMAIL" }, { status: 200 });
  }

  if (Date.now() - lastRequestAt < MIN_INTERVAL_MS) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 200 });
  }
  lastRequestAt = Date.now();

  const { token } = createMagicLink();
  const verifyUrl = `${request.nextUrl.origin}/api/auth/verify?token=${token}`;

  try {
    await sendEmail({
      to: ownerEmail,
      subject: "ลิงก์เข้าสู่โหมดแก้ไข — NVDA Instrument Wall",
      html: `<p>คลิกลิงก์นี้เพื่อเข้าสู่โหมดแก้ไข ใช้ได้ภายใน 15 นาที และใช้ได้ครั้งเดียว:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>ถ้าไม่ได้เป็นคนขอเอง ไม่ต้องทำอะไร ลิงก์นี้จะหมดอายุเอง</p>`,
    });
  } catch {
    return NextResponse.json({ error: "EMAIL_SEND_FAILED" }, { status: 200 });
  }

  return NextResponse.json({ ok: true });
}
