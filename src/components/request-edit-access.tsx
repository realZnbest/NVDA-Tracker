"use client";

import { useState } from "react";
import { useEditSession } from "./edit-session-provider";

const RESULT_MESSAGE_TH: Record<string, string> = {
  ok: "ส่งลิงก์เข้าสู่โหมดแก้ไขไปที่อีเมลของคุณแล้ว (ใช้ได้ภายใน 15 นาที)",
  rate_limited: "เพิ่งขอลิงก์ไปเมื่อสักครู่ กรุณารออีกนิดก่อนขอใหม่",
  no_email: "ยังไม่ได้ตั้งค่า OWNER_EMAIL บนเซิร์ฟเวอร์ จึงยังเปิดโหมดแก้ไขไม่ได้",
  error: "ส่งลิงก์ไม่สำเร็จ (อาจยังไม่ได้ตั้งค่า RESEND_API_KEY) ลองใหม่ภายหลัง",
};

export function RequestEditAccess({ label }: { label?: string }) {
  const { requestLink } = useEditSession();
  const [message, setMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function handleClick() {
    setSending(true);
    const result = await requestLink();
    setMessage(RESULT_MESSAGE_TH[result]);
    setSending(false);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        onClick={handleClick}
        disabled={sending}
        className="self-start telemetry text-[11px] rounded px-2 py-1 bg-ch-price-dim text-ch-price hover:brightness-125 transition-[filter] disabled:opacity-50"
      >
        {sending ? "กำลังส่งลิงก์…" : (label ?? "ขอสิทธิ์แก้ไข (ส่งลิงก์ไปอีเมล)")}
      </button>
      {message && <p className="text-[11px] text-text-muted">{message}</p>}
    </div>
  );
}
