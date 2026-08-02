"use client";

import { useEffect, useState } from "react";
import {
  computeAggregatePosition,
  computePositionMetrics,
  type AggregatePosition,
  type PositionLot,
} from "@/lib/position";
import { IconPlus, IconTrash } from "./icons";
import { useAlertsContext } from "./alerts-provider";

const TARGETS_STORAGE_KEY = "nvda-pnl-targets";

function defaultTargets(price: number): number[] {
  return [Math.round(price * 1.1), Math.round(price * 1.25), Math.round(price * 1.5)];
}

export function PnlProjectionPanel() {
  const { authStatus } = useAlertsContext();
  const [aggregate, setAggregate] = useState<AggregatePosition | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [targets, setTargets] = useState<number[]>([]);
  const [targetsLoaded, setTargetsLoaded] = useState(false);
  const [newTarget, setNewTarget] = useState("");

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    Promise.all([
      fetch("/api/position").then((r) => r.json()),
      fetch("/api/quote").then((r) => r.json()),
    ])
      .then(([positionData, quoteData]) => {
        const agg = computeAggregatePosition((positionData.lots ?? []) as PositionLot[]);
        setAggregate(agg);
        if (quoteData.quote) setPrice(quoteData.quote.c);
      })
      .catch(() => {});
  }, [authStatus]);

  // Target prices are saved to localStorage (client-side, not server state), so a page
  // refresh — or a Render redeploy, which only ever affects the server — never loses them.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(TARGETS_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed) && parsed.every((n) => typeof n === "number")) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from storage on mount
        setTargets(parsed);
      }
    } catch {
      // corrupt/blocked storage — fall back to defaults below
    }
    setTargetsLoaded(true);
  }, []);

  useEffect(() => {
    if (price === null || !targetsLoaded) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- default the target list once the live price loads, only if nothing was restored from storage
    setTargets((prev) => (prev.length === 0 ? defaultTargets(price) : prev));
  }, [price, targetsLoaded]);

  useEffect(() => {
    if (!targetsLoaded) return;
    localStorage.setItem(TARGETS_STORAGE_KEY, JSON.stringify(targets));
  }, [targets, targetsLoaded]);

  if (authStatus !== "authenticated" || !aggregate || price === null) {
    return null;
  }

  const metrics = computePositionMetrics(aggregate, price);

  function handleAddTarget(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(newTarget);
    if (!value || value <= 0 || targets.includes(value)) return;
    setTargets((prev) => [...prev, value].sort((a, b) => a - b));
    setNewTarget("");
  }

  function handleRemoveTarget(value: number) {
    setTargets((prev) => prev.filter((t) => t !== value));
  }

  return (
    <div className="module">
      <div className="module-label px-4 py-3 border-b border-seam">คาดการณ์กำไร/ขาดทุนตามราคาเป้าหมาย</div>

      <form onSubmit={handleAddTarget} className="flex items-end gap-3 px-4 py-3 border-b border-seam/60">
        <div className="flex flex-col gap-1.5">
          <label className="module-label">เพิ่มราคาเป้าหมาย ($)</label>
          <input
            type="number"
            step="0.01"
            value={newTarget}
            onChange={(e) => setNewTarget(e.target.value)}
            placeholder="เช่น 250.00"
            className="telemetry w-32 rounded border border-seam bg-panel-2 px-2 py-1.5 text-sm text-text-primary"
          />
        </div>
        <button
          type="submit"
          className="flex items-center gap-1.5 rounded bg-ch-price-dim px-3 py-1.5 text-sm text-ch-price hover:brightness-125 transition-[filter]"
        >
          <IconPlus className="h-3.5 w-3.5" />
          เพิ่มเป้าหมาย
        </button>
      </form>

      {targets.length === 0 ? (
        <p className="text-sm text-text-muted px-4 py-6">ยังไม่มีราคาเป้าหมาย</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="telemetry text-[10px] text-text-muted">
              <th className="text-left font-normal px-4 py-2">ราคาเป้าหมาย</th>
              <th className="text-right font-normal px-4 py-2">มูลค่าพอร์ต ณ ราคานี้</th>
              <th className="text-right font-normal px-4 py-2">กำไร/ขาดทุนจากราคาปัจจุบัน</th>
              <th className="text-right font-normal px-4 py-2 w-8" />
            </tr>
          </thead>
          <tbody>
            {targets.map((target) => {
              const projectedValue = aggregate.totalShares * target;
              const deltaFromCurrent = projectedValue - metrics.value;
              const deltaPercentFromCurrent = ((target - price) / price) * 100;
              const up = deltaFromCurrent >= 0;
              return (
                <tr key={target} className="border-t border-seam/60">
                  <td className="telemetry px-4 py-2.5 text-text-primary">${target.toFixed(2)}</td>
                  <td className="telemetry px-4 py-2.5 text-right text-text-secondary">
                    ${projectedValue.toFixed(2)}
                  </td>
                  <td
                    className="telemetry px-4 py-2.5 text-right"
                    style={{ color: up ? "var(--up)" : "var(--down)" }}
                  >
                    {up ? "+" : ""}${deltaFromCurrent.toFixed(2)} ({up ? "+" : ""}
                    {deltaPercentFromCurrent.toFixed(2)}%)
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => handleRemoveTarget(target)}
                      className="text-text-muted hover:text-ch-alert transition-colors"
                      aria-label="ลบราคาเป้าหมาย"
                    >
                      <IconTrash className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
