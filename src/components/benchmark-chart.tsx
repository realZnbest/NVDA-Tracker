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

const SP500_SYMBOL = "SPY";
const NASDAQ_SYMBOL = "QQQ";

const CH = {
  price: "#79b900",
  benchmark: "#5b8fd9",
  nasdaq: "#e0629c",
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
  const sp500SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const nasdaqSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const [status, setStatus] = useState<"loading" | "ready" | "error" | "no_key">("loading");
  const [nvdaChange, setNvdaChange] = useState<number | null>(null);
  const [sp500Change, setSp500Change] = useState<number | null>(null);
  const [nasdaqChange, setNasdaqChange] = useState<number | null>(null);

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
    sp500SeriesRef.current = chart.addSeries(LineSeries, {
      color: CH.benchmark,
      lineWidth: 2,
      priceFormat: { type: "custom", formatter: (v: number) => `${v.toFixed(2)}%`, minMove: 0.01 },
      priceLineVisible: false,
    });
    nasdaqSeriesRef.current = chart.addSeries(LineSeries, {
      color: CH.nasdaq,
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
      fetch(`/api/candles?tf=${timeframe}&symbol=${SP500_SYMBOL}`).then((r) => r.json()),
      fetch(`/api/candles?tf=${timeframe}&symbol=${NASDAQ_SYMBOL}`).then((r) => r.json()),
    ])
      .then(([nvdaData, sp500Data, nasdaqData]) => {
        if (cancelled) return;
        if (nvdaData.error === "MISSING_API_KEY") {
          setStatus("no_key");
          return;
        }
        if (
          nvdaData.error || !nvdaData.candles ||
          sp500Data.error || !sp500Data.candles ||
          nasdaqData.error || !nasdaqData.candles
        ) {
          setStatus("error");
          return;
        }

        const nvdaScoped = scopeCandles(nvdaData.candles as FinnhubCandles, timeframe);
        const sp500Scoped = scopeCandles(sp500Data.candles as FinnhubCandles, timeframe);
        const nasdaqScoped = scopeCandles(nasdaqData.candles as FinnhubCandles, timeframe);
        const nvdaPct = toPercentSeries(nvdaScoped);
        const sp500Pct = toPercentSeries(sp500Scoped);
        const nasdaqPct = toPercentSeries(nasdaqScoped);

        nvdaSeriesRef.current?.setData(nvdaPct);
        sp500SeriesRef.current?.setData(sp500Pct);
        nasdaqSeriesRef.current?.setData(nasdaqPct);
        chartRef.current?.timeScale().fitContent();

        setNvdaChange(nvdaPct.length > 0 ? nvdaPct[nvdaPct.length - 1].value : null);
        setSp500Change(sp500Pct.length > 0 ? sp500Pct[sp500Pct.length - 1].value : null);
        setNasdaqChange(nasdaqPct.length > 0 ? nasdaqPct[nasdaqPct.length - 1].value : null);
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
        <span className="module-label">เทียบกับตลาดรวม</span>
        <div className="flex items-center gap-4 text-[11px]">
          <Legend label="NVDA" color={CH.price} value={nvdaChange} />
          <Legend label="S&P 500" color={CH.benchmark} value={sp500Change} />
          <Legend label="NASDAQ 100" color={CH.nasdaq} value={nasdaqChange} />
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
