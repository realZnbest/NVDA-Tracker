"use client";

import { useState } from "react";
import { useAlertsContext } from "./alerts-provider";

export function AlertsPasswordGate({ compact = false }: { compact?: boolean }) {
  const { login } = useAlertsContext();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setSubmitting(true);
    setError(false);
    const ok = await login(password);
    setSubmitting(false);
    if (!ok) {
      setError(true);
      return;
    }
    setPassword("");
  }

  return (
    <form onSubmit={handleSubmit} className={compact ? "flex flex-col gap-2" : "flex flex-col gap-3 max-w-xs"}>
      <p className="text-xs text-text-muted">
        ส่วนนี้เป็นข้อมูลส่วนตัวของเจ้าของเว็บ ใส่รหัสผ่านเพื่อดู
      </p>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="รหัสผ่าน"
        autoFocus
        className="rounded border border-seam bg-bg px-2.5 py-1.5 text-sm text-text-primary outline-none focus:border-ch-price"
      />
      {error && <p className="text-xs text-ch-alert">รหัสผ่านไม่ถูกต้อง</p>}
      <button
        type="submit"
        disabled={submitting || !password}
        className="rounded bg-ch-price-dim px-3 py-1.5 text-sm text-ch-price transition-colors hover:bg-ch-price-dim/70 disabled:opacity-50"
      >
        {submitting ? "กำลังตรวจสอบ…" : "เข้าสู่ระบบ"}
      </button>
    </form>
  );
}
