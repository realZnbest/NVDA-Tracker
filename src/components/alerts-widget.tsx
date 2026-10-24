"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Alert } from "@/lib/types";
import { useAlertsContext } from "./alerts-provider";

function formatCondition(alert: Alert): string {
  return alert.threshold !== null ? `${alert.label} ${alert.threshold}` : alert.label;
}

function formatAgo(ts: number): string {
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60_000));
  if (mins < 1) return "เมื่อสักครู่";
  if (mins < 60) return `${mins} นาทีก่อน`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} ชม.ก่อน`;
  return `${Math.round(hours / 24)} วันก่อน`;
}

export function AlertsWidget() {
  const { authStatus, notifications } = useAlertsContext();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    let cancelled = false;
    fetch("/api/alerts")
      .then((r) => r.json())
      .then((data) => !cancelled && setAlerts(data.alerts ?? []))
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  async function toggle(alert: Alert) {
    setAlerts((prev) => prev.map((a) => (a.id === alert.id ? { ...a, active: !a.active } : a)));
    await fetch(`/api/alerts/${alert.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !alert.active }),
    });
  }

  if (authStatus !== "authenticated") {
    return (
      <div className="p-4">
        <p className="text-[11px] leading-relaxed text-text-muted">
          {authStatus === "checking" ? "กำลังตรวจสอบสิทธิ์…" : "เข้าสู่ระบบที่หน้าแจ้งเตือนเพื่อดูรายการ"}
        </p>
        <Link href="/alerts" className="mt-2 inline-block text-[11px] text-ch-price hover:underline">
          ไปหน้าแจ้งเตือน →
        </Link>
      </div>
    );
  }

  const active = alerts.filter((a) => a.active);
  const recent = notifications.slice(0, 5);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-1.5">
        <div className="module-label">กำลังเฝ้า ({active.length})</div>
        {loading ? (
          <p className="text-[11px] text-text-muted">กำลังโหลด…</p>
        ) : alerts.length === 0 ? (
          <p className="text-[11px] text-text-muted">ยังไม่มีการแจ้งเตือน</p>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-center justify-between gap-2 border-b border-seam/40 pb-1 text-[11px]"
            >
              <span className={`min-w-0 ${alert.active ? "text-text-secondary" : "text-text-muted"}`}>
                <span className="telemetry mr-1.5 text-text-primary">{alert.symbol ?? "พอร์ต"}</span>
                <span className="break-words">{formatCondition(alert)}</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={alert.active}
                aria-label={`${alert.active ? "ปิด" : "เปิด"}การแจ้งเตือน`}
                onClick={() => toggle(alert)}
                className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${
                  alert.active ? "bg-ch-price" : "bg-panel-2"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${
                    alert.active ? "left-3.5" : "left-0.5"
                  }`}
                />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="module-label">ทริกเกอร์ล่าสุด</div>
        {recent.length === 0 ? (
          <p className="text-[11px] text-text-muted">ยังไม่มีการแจ้งเตือนที่ทำงาน</p>
        ) : (
          recent.map((n) => (
            <div key={n.id} className="border-b border-seam/40 pb-1 text-[11px]">
              <p className={n.readAt ? "text-text-muted" : "text-text-primary"}>{n.message}</p>
              <p className="telemetry text-[10px] text-text-muted">{formatAgo(n.createdAt)}</p>
            </div>
          ))
        )}
      </div>

      <Link href="/alerts" className="text-[11px] text-ch-price hover:underline">
        จัดการการแจ้งเตือนทั้งหมด →
      </Link>
    </div>
  );
}
