"use client";

import { useEffect, useState } from "react";
import {
  computeAggregatePosition,
  computePositionMetrics,
  defaultTargets,
  type AggregatePosition,
  type PositionLot,
} from "@/lib/position";
import { IconPlus, IconTrash } from "./icons";
import { useAlertsContext } from "./alerts-provider";

// NVDA keeps its original flat key so existing saved targets carry over unchanged;
// every other symbol gets its own key so target lists don't bleed across symbols.
function targetsStorageKey(symbol: string): string {
  return symbol === "NVDA" ? "nvda-pnl-targets" : `pnl-targets:${symbol}`;
}

export function PnlProjectionPanel({ symbol = "NVDA" }: { symbol?: string }) {
  const { authStatus } = useAlertsContext();
  const [aggregate, setAggregate] = useState<AggregatePosition | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [targets, setTargets] = useState<number[]>([]);
  const [targetsLoaded, setTargetsLoaded] = useState(false);
  const [newTarget, setNewTarget] = useState("");

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    Promise.all([
      fetch(`/api/position?symbol=${symbol}`).then((r) => r.json()),
      fetch(`/api/quote?symbol=${symbol}`).then((r) => r.json()),
    ])
      .then(([positionData, quoteData]) => {
        const agg = computeAggregatePosition((positionData.lots ?? []) as PositionLot[]);
        setAggregate(agg);
        if (quoteData.quote) setPrice(quoteData.quote.c);
      })
      .catch(() => {});
  }, [authStatus, symbol]);

  // Target prices are saved to localStorage (client-side, not server state), so a page
  // refresh — or a Render redeploy, which only ever affects the server — never loses them.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset when switching symbols so stale targets don't flash
    setTargetsLoaded(false);
    try {
      const raw = localStorage.getItem(targetsStorageKey(symbol));
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed) && parsed.every((n) => typeof n === "number")) {
        setTargets(parsed);
      } else {
        setTargets([]);
      }
    } catch {
      setTargets([]);
    }
    setTargetsLoaded(true);
  }, [symbol]);

  useEffect(() => {
    if (price === null || !targetsLoaded) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- default the target list once the live price loads, only if nothing was restored from storage
    setTargets((prev) => (prev.length === 0 ? defaultTargets(price) : prev));
  }, [price, targetsLoaded]);

  useEffect(() => {
    if (!targetsLoaded) return;
    localStorage.setItem(targetsStorageKey(symbol), JSON.stringify(targets));
  }, [targets, targetsLoaded, symbol]);

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
            inputMode="decimal"
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
