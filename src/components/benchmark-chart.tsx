"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { scopeCandles, type TimeframeKey } from "@/lib/timeframes";
import type { FinnhubCandles } from "@/lib/finnhub";

const BENCHMARK_SYMBOL = "SPY";

const CH = {
  price: "#79b900",
  benchmark: "#5b8fd9",
  text: "#9aa4b2",
  seam: "#262c35",
};

function toPercentSeries(candles: FinnhubCandles) {
  if (candles.c.length === 0) return [];
  const base = candles.c[0];
  return candles.t.map((t, i) => ({
    time: t as UTCTimestamp,
    value: ((candles.c[i] - base) / base) * 100,
  }));
}

export function BenchmarkChart({ timeframe }: { timeframe: TimeframeKey }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const nvdaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const benchmarkSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const [status, setStatus] = useState<"loading" | "ready" | "error" | "no_key">("loading");
  const [nvdaChange, setNvdaChange] = useState<number | null>(null);
  const [benchmarkChange, setBenchmarkChange] = useState<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: "transparent" },
        textColor: CH.text,
        fontFamily: "var(--font-mono)",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.03)" },
        horzLines: { color: "rgba(255,255,255,0.03)" },
      },
      rightPriceScale: { borderColor: CH.seam },
      timeScale: { borderColor: CH.seam, timeVisible: true, secondsVisible: false },
      handleScroll: { vertTouchDrag: false },
      autoSize: true,
      height: 240,
    });
    chartRef.current = chart;
    nvdaSeriesRef.current = chart.addSeries(LineSeries, {
      color: CH.price,
      lineWidth: 2,
      priceFormat: { type: "custom", formatter: (v: number) => `${v.toFixed(2)}%`, minMove: 0.01 },
      priceLineVisible: false,
    });
    benchmarkSeriesRef.current = chart.addSeries(LineSeries, {
      color: CH.benchmark,
      lineWidth: 2,
      priceFormat: { type: "custom", formatter: (v: number) => `${v.toFixed(2)}%`, minMove: 0.01 },
      priceLineVisible: false,
    });

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset status when the timeframe changes
    setStatus("loading");

    Promise.all([
      fetch(`/api/candles?tf=${timeframe}`).then((r) => r.json()),
      fetch(`/api/candles?tf=${timeframe}&symbol=${BENCHMARK_SYMBOL}`).then((r) => r.json()),
    ])
      .then(([nvdaData, benchmarkData]) => {
        if (cancelled) return;
        if (nvdaData.error === "MISSING_API_KEY") {
          setStatus("no_key");
          return;
        }
        if (nvdaData.error || !nvdaData.candles || benchmarkData.error || !benchmarkData.candles) {
          setStatus("error");
          return;
        }

        const nvdaScoped = scopeCandles(nvdaData.candles as FinnhubCandles, timeframe);
        const benchmarkScoped = scopeCandles(benchmarkData.candles as FinnhubCandles, timeframe);
        const nvdaPct = toPercentSeries(nvdaScoped);
        const benchmarkPct = toPercentSeries(benchmarkScoped);

        nvdaSeriesRef.current?.setData(nvdaPct);
        benchmarkSeriesRef.current?.setData(benchmarkPct);
        chartRef.current?.timeScale().fitContent();

        setNvdaChange(nvdaPct.length > 0 ? nvdaPct[nvdaPct.length - 1].value : null);
        setBenchmarkChange(benchmarkPct.length > 0 ? benchmarkPct[benchmarkPct.length - 1].value : null);
        setStatus("ready");
      })
      .catch(() => !cancelled && setStatus("error"));

    return () => {
      cancelled = true;
    };
  }, [timeframe]);

  return (
    <div className="module flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-seam px-4 py-2.5">
        <span className="module-label">เทียบกับตลาดรวม (S&P 500)</span>
        <div className="flex items-center gap-4 text-[11px]">
          <Legend label="NVDA" color={CH.price} value={nvdaChange} />
          <Legend label="S&P 500" color={CH.benchmark} value={benchmarkChange} />
        </div>
      </div>

      {status === "loading" && <p className="text-sm text-text-muted px-4 py-6">กำลังโหลด…</p>}
      {status === "no_key" && (
        <p className="text-sm text-text-muted px-4 py-6">ต้องตั้งค่า FINNHUB_API_KEY ก่อนจึงจะดูข้อมูลนี้ได้</p>
      )}
      {status === "error" && <p className="text-sm text-text-muted px-4 py-6">โหลดข้อมูลไม่สำเร็จ</p>}

      <div ref={containerRef} className="h-60 w-full" />
    </div>
  );
}

function Legend({ label, color, value }: { label: string; color: string; value: number | null }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      <span className="text-text-secondary">{label}</span>
      {value !== null && (
        <span className="telemetry" style={{ color: value >= 0 ? "var(--up)" : "var(--down)" }}>
          {value >= 0 ? "+" : ""}
          {value.toFixed(2)}%
        </span>
      )}
    </div>
  );
}
