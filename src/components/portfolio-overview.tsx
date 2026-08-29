"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAlertsContext } from "./alerts-provider";
import { AlertsPasswordGate } from "./alerts-password-gate";
import { IconPlus } from "./icons";
import { SymbolSearchInput, type SymbolSearchResult } from "./symbol-search-input";
import type { AggregatePosition } from "@/lib/position";

interface SymbolRow {
  symbol: string;
  aggregate: AggregatePosition;
  price: number | null;
}

export function PortfolioOverview() {
  const router = useRouter();
  const { authStatus } = useAlertsContext();
  const [rows, setRows] = useState<SymbolRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [newSymbol, setNewSymbol] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- show the loading state immediately on mount/auth
    setLoading(true);
    fetch("/api/position")
      .then((r) => r.json())
      .then(async (data) => {
        if (cancelled) return;
        const aggregates = (data.aggregates ?? {}) as Record<string, AggregatePosition>;
        const symbols = Object.keys(aggregates);
        const prices = await Promise.all(
          symbols.map((symbol) =>
            fetch(`/api/quote?symbol=${symbol}`)
              .then((r) => r.json())
              .then((q) => (q.quote ? (q.quote.c as number) : null))
              .catch(() => null)
          )
        );
        if (cancelled) return;
        setRows(
          symbols.map((symbol, i) => ({
            symbol,
            aggregate: aggregates[symbol],
            price: prices[i],
          }))
        );
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
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

  function handleSelectSymbol(result: SymbolSearchResult) {
    setNewSymbol("");
    setShowAddForm(false);
    // Route straight to the (empty) detail page — adding the first lot happens there,
    // reusing the exact same add-lot form every other symbol's history uses.
    router.push(`/portfolio/${result.symbol}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="module">
        <div className="flex items-center justify-between px-4 py-3 border-b border-seam">
          <span className="module-label">โพซิชันที่เปิดอยู่ ({rows.length})</span>
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="flex items-center gap-1.5 text-[0.6875rem] text-text-muted hover:text-text-primary transition-colors"
          >
            <IconPlus className="h-3.5 w-3.5" />
            เพิ่มโพซิชันใหม่
          </button>
        </div>

        {showAddForm && (
          <div className="flex flex-wrap items-end gap-3 px-4 py-3 border-b border-seam/60">
            <div className="flex flex-col gap-1.5 w-64">
              <label className="module-label">ค้นหาหุ้นที่จะเพิ่ม</label>
              <SymbolSearchInput
                value={newSymbol}
                onChange={setNewSymbol}
                onSelect={handleSelectSymbol}
                autoFocus
              />
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-text-muted px-4 py-6">กำลังโหลด…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-text-muted px-4 py-6">ยังไม่มีโพซิชันที่เปิดอยู่</p>
        ) : (
          <ul>
            {rows.map((row) => (
              <SymbolRowItem key={row.symbol} row={row} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function SymbolRowItem({ row }: { row: SymbolRow }) {
  const { symbol, aggregate, price } = row;
  const value = price !== null ? aggregate.totalShares * price : null;
  const costBasis = aggregate.totalShares * aggregate.avgCost;
  const pnl = value !== null ? value - costBasis : null;
  const pnlPercent = pnl !== null && costBasis !== 0 ? (pnl / costBasis) * 100 : null;
  const up = pnl !== null && pnl >= 0;

  return (
    <li className="border-b border-seam/60 last:border-b-0">
      <Link
        href={`/portfolio/${symbol}`}
        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors"
      >
        <div className="min-w-0">
          <p className="text-sm text-text-primary font-medium">{symbol}</p>
          <p className="telemetry text-[0.6875rem] text-text-muted">
            {aggregate.totalShares.toLocaleString()} หุ้น · ต้นทุนเฉลี่ย ${aggregate.avgCost.toFixed(2)}
          </p>
        </div>
        <div className="flex items-center gap-6 telemetry text-sm">
          <div className="text-right">
            <p className="text-text-secondary text-[0.625rem]">มูลค่าปัจจุบัน</p>
            <p className="text-text-primary">{value !== null ? `$${value.toFixed(2)}` : "—"}</p>
          </div>
          <div className="text-right min-w-[110px]">
            <p className="text-text-secondary text-[0.625rem]">กำไร/ขาดทุน</p>
            <p style={{ color: pnl !== null ? (up ? "var(--up)" : "var(--down)") : undefined }}>
              {pnl !== null && pnlPercent !== null
                ? `${up ? "+" : ""}$${pnl.toFixed(2)} (${up ? "+" : ""}${pnlPercent.toFixed(2)}%)`
                : "—"}
            </p>
          </div>
        </div>
      </Link>
    </li>
  );
}
