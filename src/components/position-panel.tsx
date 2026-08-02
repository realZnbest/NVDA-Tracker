"use client";

import { useEffect, useState } from "react";
import { computeAggregatePosition, computePositionMetrics, type PositionLot } from "@/lib/position";
import { IconPlus, IconTrash } from "./icons";
import { useAlertsContext } from "./alerts-provider";
import { AlertsPasswordGate } from "./alerts-password-gate";

function toDateInputValue(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function fromDateInputValue(value: string): number {
  return new Date(`${value}T00:00:00`).getTime();
}

export function PositionPanel() {
  const { authStatus, logout } = useAlertsContext();
  const [lots, setLots] = useState<PositionLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [price, setPrice] = useState<number | null>(null);

  const [purchaseDate, setPurchaseDate] = useState("");
  const [shares, setShares] = useState("");
  const [pricePerShare, setPricePerShare] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editShares, setEditShares] = useState("");
  const [editPrice, setEditPrice] = useState("");

  const refresh = () =>
    fetch("/api/position")
      .then((r) => r.json())
      .then((data) => setLots(data.lots ?? []))
      .finally(() => setLoading(false));

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- default the date field to today on mount
    setPurchaseDate(toDateInputValue(Date.now()));
  }, []);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    refresh();
    fetch("/api/quote")
      .then((r) => r.json())
      .then((data) => {
        if (data.quote) setPrice(data.quote.c);
      })
      .catch(() => {});
  }, [authStatus]);

  if (authStatus === "checking") {
    return <p className="text-sm text-text-muted">กำลังตรวจสอบสิทธิ์…</p>;
  }

  if (authStatus === "not_configured") {
    return (
      <p className="text-sm text-text-muted">
        ยังไม่ได้ตั้งค่า ALERTS_PASSWORD บนเซิร์ฟเวอร์ — เพิ่มตัวแปรนี้ก่อนจึงจะใช้ระบบพอร์ตได้
      </p>
    );
  }

  if (authStatus !== "authenticated") {
    return <AlertsPasswordGate />;
  }

  const aggregate = computeAggregatePosition(lots);
  const metrics = aggregate && price !== null ? computePositionMetrics(aggregate, price) : null;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!shares || !pricePerShare) return;
    setSubmitting(true);
    await fetch("/api/position", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        purchaseDate: fromDateInputValue(purchaseDate),
        shares: Number(shares),
        pricePerShare: Number(pricePerShare),
      }),
    });
    setShares("");
    setPricePerShare("");
    setSubmitting(false);
    refresh();
  }

  function startEdit(lot: PositionLot) {
    setEditingId(lot.id);
    setEditDate(toDateInputValue(lot.purchaseDate));
    setEditShares(String(lot.shares));
    setEditPrice(String(lot.pricePerShare));
  }

  async function handleSaveEdit(id: string) {
    await fetch(`/api/position/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        purchaseDate: fromDateInputValue(editDate),
        shares: Number(editShares),
        pricePerShare: Number(editPrice),
      }),
    });
    setEditingId(null);
    refresh();
  }

  async function handleDelete(id: string) {
    setLots((prev) => prev.filter((l) => l.id !== id));
    await fetch(`/api/position/${id}`, { method: "DELETE" });
  }

  return (
    <div className="flex flex-col gap-4">
      {metrics && aggregate && (
        <div className="module p-4 flex flex-wrap gap-6">
          <Stat label="หุ้นทั้งหมด" value={aggregate.totalShares.toLocaleString()} />
          <Stat label="ต้นทุนเฉลี่ย" value={`$${aggregate.avgCost.toFixed(2)}`} />
          <Stat label="มูลค่าปัจจุบัน" value={`$${metrics.value.toFixed(2)}`} />
          <Stat
            label="กำไร/ขาดทุน"
            value={`${metrics.unrealizedPnl >= 0 ? "+" : ""}$${metrics.unrealizedPnl.toFixed(2)} (${
              metrics.unrealizedPnl >= 0 ? "+" : ""
            }${metrics.unrealizedPnlPercent.toFixed(2)}%)`}
            color={metrics.unrealizedPnl >= 0 ? "var(--up)" : "var(--down)"}
          />
        </div>
      )}

      <form onSubmit={handleCreate} className="module p-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="module-label">วันที่ซื้อ</label>
          <input
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
            className="telemetry rounded border border-seam bg-panel-2 px-2 py-1.5 text-sm text-text-primary"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="module-label">จำนวนหุ้น</label>
          <input
            type="number"
            step="0.0001"
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            placeholder="เช่น 10"
            className="telemetry w-28 rounded border border-seam bg-panel-2 px-2 py-1.5 text-sm text-text-primary"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="module-label">ราคาต่อหุ้น ($)</label>
          <input
            type="number"
            step="0.01"
            value={pricePerShare}
            onChange={(e) => setPricePerShare(e.target.value)}
            placeholder="เช่น 150.00"
            className="telemetry w-32 rounded border border-seam bg-panel-2 px-2 py-1.5 text-sm text-text-primary"
            required
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-1.5 rounded bg-ch-price-dim px-3 py-1.5 text-sm text-ch-price hover:brightness-125 transition-[filter] disabled:opacity-50"
        >
          <IconPlus className="h-3.5 w-3.5" />
          เพิ่มการซื้อ
        </button>
      </form>

      <div className="module">
        <div className="flex items-center justify-between px-4 py-3 border-b border-seam">
          <span className="module-label">ประวัติการซื้อ ({lots.length})</span>
          <button
            onClick={() => logout()}
            className="text-[11px] text-text-muted hover:text-text-primary transition-colors"
          >
            ออกจากระบบ
          </button>
        </div>
        {loading ? (
          <p className="text-sm text-text-muted px-4 py-6">กำลังโหลด…</p>
        ) : lots.length === 0 ? (
          <p className="text-sm text-text-muted px-4 py-6">ยังไม่มีรายการซื้อ</p>
        ) : (
          <ul>
            {lots.map((lot) =>
              editingId === lot.id ? (
                <li key={lot.id} className="flex flex-wrap items-end gap-3 px-4 py-3 border-b border-seam/60 last:border-b-0">
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="telemetry rounded border border-seam bg-panel-2 px-2 py-1.5 text-sm text-text-primary"
                  />
                  <input
                    type="number"
                    step="0.0001"
                    value={editShares}
                    onChange={(e) => setEditShares(e.target.value)}
                    className="telemetry w-24 rounded border border-seam bg-panel-2 px-2 py-1.5 text-sm text-text-primary"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="telemetry w-28 rounded border border-seam bg-panel-2 px-2 py-1.5 text-sm text-text-primary"
                  />
                  <button
                    onClick={() => handleSaveEdit(lot.id)}
                    className="telemetry text-[11px] rounded px-2 py-1 text-up bg-up/10"
                  >
                    บันทึก
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="telemetry text-[11px] rounded px-2 py-1 text-text-muted bg-white/5"
                  >
                    ยกเลิก
                  </button>
                </li>
              ) : (
                <li
                  key={lot.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 border-b border-seam/60 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-text-primary truncate">
                      {lot.shares.toLocaleString()} หุ้น
                      <span className="telemetry text-text-secondary"> · ${lot.pricePerShare.toFixed(2)}</span>
                    </p>
                    <p className="telemetry text-[10px] text-text-muted">
                      {new Date(lot.purchaseDate).toLocaleDateString("th-TH")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() => startEdit(lot)}
                      className="telemetry text-[11px] rounded px-2 py-1 text-text-muted bg-white/5 hover:text-text-primary"
                    >
                      แก้ไข
                    </button>
                    <button
                      onClick={() => handleDelete(lot.id)}
                      className="text-text-muted hover:text-ch-alert transition-colors"
                      aria-label="ลบ"
                    >
                      <IconTrash className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              )
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="module-label">{label}</span>
      <span className="telemetry text-lg" style={color ? { color } : undefined}>
        {value}
      </span>
    </div>
  );
}
