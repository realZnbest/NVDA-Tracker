"use client";

import { useEffect, useState } from "react";
import { ALERT_TYPE_LABEL_TH, type Alert, type AlertType } from "@/lib/types";
import { IconPlus, IconTrash } from "./icons";
import { useAlertsContext } from "./alerts-provider";
import { AlertsPasswordGate } from "./alerts-password-gate";

const TYPES_WITH_THRESHOLD: AlertType[] = ["price_above", "price_below"];
const TYPES_WITH_OPTIONAL_THRESHOLD: AlertType[] = ["rsi_overbought", "rsi_oversold"];

const DEFAULT_THRESHOLD: Partial<Record<AlertType, number>> = {
  rsi_overbought: 70,
  rsi_oversold: 30,
};

export function AlertsManager() {
  const { authStatus, logout } = useAlertsContext();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  const [type, setType] = useState<AlertType>("price_above");
  const [threshold, setThreshold] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const refresh = () =>
    fetch("/api/alerts")
      .then((r) => r.json())
      .then((data) => setAlerts(data.alerts ?? []))
      .finally(() => setLoading(false));

  useEffect(() => {
    if (authStatus === "authenticated") refresh();
  }, [authStatus]);

  if (authStatus === "checking") {
    return <p className="text-sm text-text-muted">กำลังตรวจสอบสิทธิ์…</p>;
  }

  if (authStatus === "not_configured") {
    return (
      <p className="text-sm text-text-muted">
        ยังไม่ได้ตั้งค่า ALERTS_PASSWORD บนเซิร์ฟเวอร์ — เพิ่มตัวแปรนี้ก่อนจึงจะใช้การแจ้งเตือนได้
      </p>
    );
  }

  if (authStatus !== "authenticated") {
    return <AlertsPasswordGate />;
  }

  const needsThreshold = TYPES_WITH_THRESHOLD.includes(type);
  const optionalThreshold = TYPES_WITH_OPTIONAL_THRESHOLD.includes(type);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (needsThreshold && !threshold) return;
    setSubmitting(true);
    const label = ALERT_TYPE_LABEL_TH[type];
    const thresholdValue = threshold
      ? Number(threshold)
      : DEFAULT_THRESHOLD[type] ?? null;
    await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, label, threshold: thresholdValue }),
    });
    setThreshold("");
    setSubmitting(false);
    refresh();
  }

  async function handleToggle(alert: Alert) {
    setAlerts((prev) =>
      prev.map((a) => (a.id === alert.id ? { ...a, active: !a.active } : a))
    );
    await fetch(`/api/alerts/${alert.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !alert.active }),
    });
  }

  async function handleDelete(id: string) {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    await fetch(`/api/alerts/${id}`, { method: "DELETE" });
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleCreate} className="module p-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="module-label">ประเภทการแจ้งเตือน</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as AlertType)}
            className="telemetry rounded border border-seam bg-panel-2 px-2 py-1.5 text-sm text-text-primary"
          >
            {(Object.keys(ALERT_TYPE_LABEL_TH) as AlertType[]).map((t) => (
              <option key={t} value={t}>
                {ALERT_TYPE_LABEL_TH[t]}
              </option>
            ))}
          </select>
        </div>

        {(needsThreshold || optionalThreshold) && (
          <div className="flex flex-col gap-1.5">
            <label className="module-label">
              {type.startsWith("price") ? "ราคาเป้าหมาย ($)" : "เกณฑ์ (ค่าเริ่มต้นถ้าเว้นว่าง)"}
            </label>
            <input
              type="number"
              step="0.01"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder={
                optionalThreshold ? String(DEFAULT_THRESHOLD[type] ?? "") : "เช่น 150.00"
              }
              className="telemetry w-36 rounded border border-seam bg-panel-2 px-2 py-1.5 text-sm text-text-primary"
              required={needsThreshold}
            />
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-1.5 rounded bg-ch-price-dim px-3 py-1.5 text-sm text-ch-price hover:brightness-125 transition-[filter] disabled:opacity-50"
        >
          <IconPlus className="h-3.5 w-3.5" />
          เพิ่มการแจ้งเตือน
        </button>
      </form>

      <div className="module">
        <div className="flex items-center justify-between px-4 py-3 border-b border-seam">
          <span className="module-label">รายการที่ตั้งไว้ ({alerts.length})</span>
          <button
            onClick={() => logout()}
            className="text-[11px] text-text-muted hover:text-text-primary transition-colors"
          >
            ออกจากระบบ
          </button>
        </div>
        {loading ? (
          <p className="text-sm text-text-muted px-4 py-6">กำลังโหลด…</p>
        ) : alerts.length === 0 ? (
          <p className="text-sm text-text-muted px-4 py-6">ยังไม่มีการแจ้งเตือนที่ตั้งไว้</p>
        ) : (
          <ul>
            {alerts.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 px-4 py-3 border-b border-seam/60 last:border-b-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${a.active ? "lit" : ""}`}
                    style={{
                      background: a.active ? "var(--ch-alert)" : "var(--seam-bright)",
                      boxShadow: a.active ? "0 0 6px var(--ch-alert)" : "none",
                    }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm text-text-primary truncate">
                      {a.label}
                      {a.threshold !== null && (
                        <span className="telemetry text-text-secondary"> · {a.threshold}</span>
                      )}
                    </p>
                    <p className="telemetry text-[10px] text-text-muted">
                      {a.lastTriggeredAt
                        ? `ทริกเกอร์ล่าสุด ${new Date(a.lastTriggeredAt).toLocaleString("th-TH")}`
                        : "ยังไม่เคยทริกเกอร์"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => handleToggle(a)}
                    className={`telemetry text-[11px] rounded px-2 py-1 ${
                      a.active ? "text-up bg-up/10" : "text-text-muted bg-white/5"
                    }`}
                  >
                    {a.active ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                  </button>
                  <button
                    onClick={() => handleDelete(a.id)}
                    className="text-text-muted hover:text-ch-alert transition-colors"
                    aria-label="ลบ"
                  >
                    <IconTrash className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
