"use client";

import { useEffect, useState } from "react";
import { computePositionMetrics, type Position } from "@/lib/position";
import { useEditSession } from "./edit-session-provider";
import { RequestEditAccess } from "./request-edit-access";

function toDateInputValue(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

export function PositionPanel() {
  const { canEdit, logout } = useEditSession();
  const [position, setPosition] = useState<Position | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [editing, setEditing] = useState(false);

  const load = () => {
    Promise.all([
      fetch("/api/position").then((r) => r.json()),
      fetch("/api/quote").then((r) => r.json()),
    ])
      .then(([pos, quote]) => {
        setPosition(pos.position);
        if (quote.quote?.c) setPrice(quote.quote.c);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  };

  useEffect(load, []);

  const metrics = position && price !== null ? computePositionMetrics(position, price) : null;

  return (
    <div className="module p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="module-label">ตำแหน่งของฉัน</div>
        {canEdit && (
          <div className="flex items-center gap-3">
            {position && !editing && (
              <button
                onClick={() => setEditing(true)}
                className="telemetry text-[11px] text-text-muted hover:text-text-primary transition-colors"
              >
                แก้ไข
              </button>
            )}
            <button
              onClick={logout}
              className="telemetry text-[11px] text-text-muted hover:text-ch-alert transition-colors"
            >
              ออกจากโหมดแก้ไข
            </button>
          </div>
        )}
      </div>

      {status === "loading" && <p className="text-sm text-text-muted">กำลังโหลด…</p>}
      {status === "error" && <p className="text-sm text-text-muted">โหลดข้อมูลตำแหน่งไม่สำเร็จ</p>}

      {status === "ready" && (editing || !position) && canEdit && (
        <PositionForm
          initial={position}
          onSaved={() => {
            setEditing(false);
            load();
          }}
          onCancel={position ? () => setEditing(false) : undefined}
        />
      )}

      {status === "ready" && !editing && !position && !canEdit && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-text-muted">ยังไม่ได้ตั้งค่าตำแหน่งของคุณ</p>
          <RequestEditAccess />
        </div>
      )}

      {status === "ready" && !editing && position && metrics && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="มูลค่าปัจจุบัน" value={`$${metrics.value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`} />
          <Stat
            label="กำไร/ขาดทุน"
            value={`${metrics.unrealizedPnl >= 0 ? "+" : ""}$${metrics.unrealizedPnl.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
            color={metrics.unrealizedPnl >= 0 ? "var(--up)" : "var(--down)"}
          />
          <Stat
            label="% กำไร/ขาดทุน"
            value={`${metrics.unrealizedPnlPercent >= 0 ? "+" : ""}${metrics.unrealizedPnlPercent.toFixed(2)}%`}
            color={metrics.unrealizedPnlPercent >= 0 ? "var(--up)" : "var(--down)"}
          />
          <Stat label="ถือมาแล้ว" value={`${metrics.daysHeld} วัน`} />
          <Stat label="ต้นทุนเฉลี่ย" value={`$${position.avgCost.toFixed(2)}`} />
          <Stat label="จำนวนหุ้น" value={position.shares.toLocaleString("en-US")} />
          <Stat label="ต้นทุนรวม" value={`$${metrics.costBasis.toLocaleString("en-US", { maximumFractionDigits: 0 })}`} />
          <Stat label="เริ่มถือ" value={toDateInputValue(position.startDate)} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="module-label mb-1">{label}</div>
      <div className="telemetry text-base" style={{ color: color ?? "var(--text-primary)" }}>
        {value}
      </div>
    </div>
  );
}

function PositionForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial: Position | null;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [avgCost, setAvgCost] = useState(initial ? String(initial.avgCost) : "");
  const [shares, setShares] = useState(initial ? String(initial.shares) : "");
  const [startDate, setStartDate] = useState(() =>
    initial ? toDateInputValue(initial.startDate) : toDateInputValue(Date.now())
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/position", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        avgCost: Number(avgCost),
        shares: Number(shares),
        startDate: new Date(startDate).getTime(),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
      return;
    }
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <Field label="ต้นทุนเฉลี่ยต่อหุ้น ($)">
        <input
          type="number"
          step="0.01"
          min="0"
          required
          value={avgCost}
          onChange={(e) => setAvgCost(e.target.value)}
          className="telemetry w-28 rounded border border-seam bg-panel-2 px-2 py-1.5 text-sm text-text-primary"
        />
      </Field>
      <Field label="จำนวนหุ้น">
        <input
          type="number"
          step="0.0001"
          min="0"
          required
          value={shares}
          onChange={(e) => setShares(e.target.value)}
          className="telemetry w-28 rounded border border-seam bg-panel-2 px-2 py-1.5 text-sm text-text-primary"
        />
      </Field>
      <Field label="วันที่เริ่มถือ">
        <input
          type="date"
          required
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="telemetry rounded border border-seam bg-panel-2 px-2 py-1.5 text-sm text-text-primary"
        />
      </Field>
      <button
        type="submit"
        disabled={saving}
        className="rounded bg-ch-price-dim px-3 py-1.5 text-sm text-ch-price hover:brightness-125 transition-[filter] disabled:opacity-50"
      >
        {saving ? "กำลังบันทึก…" : "บันทึก"}
      </button>
      {onCancel && (
        <button type="button" onClick={onCancel} className="text-sm text-text-muted hover:text-text-primary">
          ยกเลิก
        </button>
      )}
      {error && <p className="w-full text-xs text-ch-alert">{error}</p>}
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="module-label">{label}</span>
      {children}
    </label>
  );
}
