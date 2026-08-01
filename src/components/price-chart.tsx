"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { TIMEFRAMES, type TimeframeKey } from "@/lib/timeframes";
import {
  bollinger,
  computeSupportResistance,
  detectStructureBreaks,
  findPivots,
  macd,
  movingAverageOf,
  rsi,
  sma,
} from "@/lib/indicators";
import type { FinnhubCandles } from "@/lib/finnhub";
import type { Position } from "@/lib/position";

const CH = {
  price: "#79b900",
  volume: "#3fc4d8",
  rsi: "#b28cf2",
  rsiMa: "#e3a94b",
  macd: "#2fd6a6",
  up: "#34d17c",
  down: "#ef5b5b",
  choch: "#f2c879",
  text: "#9aa4b2",
  seam: "#262c35",
};

interface Params {
  ma1: number;
  ma2: number;
  ma3: number;
  bbPeriod: number;
  bbMult: number;
  rsiPeriod: number;
  rsiMaPeriod: number;
  swingBars: number;
}

const DEFAULT_PARAMS: Params = {
  ma1: 20,
  ma2: 50,
  ma3: 200,
  bbPeriod: 20,
  bbMult: 2,
  rsiPeriod: 14,
  rsiMaPeriod: 14,
  swingBars: 5,
};

export function PriceChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<Record<string, ISeriesApi<"Candlestick" | "Line" | "Histogram">>>({});
  const markersPluginRef = useRef<ReturnType<typeof createSeriesMarkers<Time>> | null>(null);
  const srLinesRef = useRef<IPriceLine[]>([]);
  const breakEvenLineRef = useRef<IPriceLine | null>(null);

  const [timeframe, setTimeframe] = useState<TimeframeKey>("1H");
  const [candles, setCandles] = useState<FinnhubCandles | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "no_key">("loading");
  const [params, setParams] = useState<Params>(DEFAULT_PARAMS);

  const [showMa1, setShowMa1] = useState(true);
  const [showMa2, setShowMa2] = useState(true);
  const [showMa3, setShowMa3] = useState(false);
  const [showBollinger, setShowBollinger] = useState(false);
  const [showRsi, setShowRsi] = useState(true);
  const [showRsiMa, setShowRsiMa] = useState(true);
  const [showMacd, setShowMacd] = useState(true);
  const [showSR, setShowSR] = useState(true);
  const [showStructure, setShowStructure] = useState(true);
  const [showBreakEven, setShowBreakEven] = useState(true);
  const [position, setPosition] = useState<Position | null>(null);

  useEffect(() => {
    fetch("/api/position")
      .then((r) => r.json())
      .then((data) => setPosition(data.position))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset status when the timeframe changes
    setStatus("loading");
    fetch(`/api/candles?tf=${timeframe}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error === "MISSING_API_KEY") {
          setStatus("no_key");
          return;
        }
        if (data.error || !data.candles) {
          setStatus("error");
          return;
        }
        setCandles(data.candles);
        setStatus("ready");
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
    };
  }, [timeframe]);

  const computed = useMemo(() => {
    if (!candles) return null;
    const closes = candles.c;
    const rsiSeries = rsi(closes, params.rsiPeriod);
    const lastClose = closes[closes.length - 1];

    // Support/resistance and BOS/CHoCH are only meaningful over recent price action —
    // the candle fetch itself can span decades (so zooming out reveals real history),
    // but a "support" level from NVDA's 1999 IPO price is just noise today. Scope
    // structure detection to a multiple of the selected tab's own window instead.
    const tf = TIMEFRAMES.find((t) => t.key === timeframe);
    const lastTime = candles.t[candles.t.length - 1];
    const scopeDaysNum =
      tf?.scopeDays === "ytd"
        ? (lastTime - Date.UTC(new Date(lastTime * 1000).getUTCFullYear(), 0, 1) / 1000) / 86400
        : tf?.scopeDays ?? 365;
    const windowStart = lastTime - Math.max(scopeDaysNum * 4, 30) * 24 * 60 * 60;
    let startIndex = candles.t.findIndex((t) => t >= windowStart);
    if (startIndex === -1) startIndex = 0;

    const wt = candles.t.slice(startIndex);
    const wh = candles.h.slice(startIndex);
    const wl = candles.l.slice(startIndex);
    const wc = closes.slice(startIndex);

    const pivots = findPivots(wt, wh, wl, params.swingBars, params.swingBars);

    return {
      ma1: sma(closes, params.ma1),
      ma2: sma(closes, params.ma2),
      ma3: sma(closes, params.ma3),
      bb: bollinger(closes, params.bbPeriod, params.bbMult),
      rsi: rsiSeries,
      rsiMa: movingAverageOf(rsiSeries, params.rsiMaPeriod),
      macd: macd(closes),
      sr: computeSupportResistance(pivots, lastClose),
      structure: detectStructureBreaks(wt, wh, wl, wc, params.swingBars, params.swingBars),
    };
  }, [candles, params, timeframe]);

  // create chart once
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: "transparent" },
        textColor: CH.text,
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        panes: { separatorColor: CH.seam, separatorHoverColor: "#333b46" },
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.03)" },
        horzLines: { color: "rgba(255,255,255,0.03)" },
      },
      crosshair: {
        vertLine: { color: CH.price, width: 1, style: 3, labelBackgroundColor: CH.price },
        horzLine: { color: CH.price, width: 1, style: 3, labelBackgroundColor: CH.price },
      },
      rightPriceScale: { borderColor: CH.seam },
      timeScale: { borderColor: CH.seam, timeVisible: true, secondsVisible: false },
      autoSize: true,
    });
    chartRef.current = chart;

    const candleSeries = chart.addSeries(
      CandlestickSeries,
      {
        upColor: CH.up,
        downColor: CH.down,
        borderVisible: false,
        wickUpColor: CH.up,
        wickDownColor: CH.down,
      },
      0
    );
    candleSeries.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: 0.02 } });
    markersPluginRef.current = createSeriesMarkers(candleSeries, []);

    const ma1Series = chart.addSeries(LineSeries, { color: CH.price, lineWidth: 1, priceLineVisible: false }, 0);
    const ma2Series = chart.addSeries(LineSeries, { color: "#8fb8ff", lineWidth: 1, priceLineVisible: false }, 0);
    const ma3Series = chart.addSeries(LineSeries, { color: "#ff9f6e", lineWidth: 1, priceLineVisible: false }, 0);
    const bbUpperSeries = chart.addSeries(LineSeries, { color: "rgba(154,164,178,0.5)", lineWidth: 1, priceLineVisible: false }, 0);
    const bbLowerSeries = chart.addSeries(LineSeries, { color: "rgba(154,164,178,0.5)", lineWidth: 1, priceLineVisible: false }, 0);

    const volumeSeries = chart.addSeries(
      HistogramSeries,
      { color: CH.volume, priceFormat: { type: "volume" }, priceLineVisible: false },
      1
    );
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.1, bottom: 0 } });

    const rsiSeries = chart.addSeries(LineSeries, { color: CH.rsi, lineWidth: 2, priceLineVisible: false }, 2);
    const rsiMaSeries = chart.addSeries(LineSeries, { color: CH.rsiMa, lineWidth: 1, priceLineVisible: false }, 2);
    const rsiUpper = chart.addSeries(LineSeries, { color: "rgba(239,74,74,0.4)", lineWidth: 1, priceLineVisible: false }, 2);
    const rsiLower = chart.addSeries(LineSeries, { color: "rgba(52,209,124,0.4)", lineWidth: 1, priceLineVisible: false }, 2);

    const macdSeries = chart.addSeries(LineSeries, { color: CH.macd, lineWidth: 2, priceLineVisible: false }, 3);
    const macdSignalSeries = chart.addSeries(LineSeries, { color: "#d99a4e", lineWidth: 1, priceLineVisible: false }, 3);
    const macdHistSeries = chart.addSeries(HistogramSeries, { priceLineVisible: false }, 3);

    seriesRef.current = {
      candle: candleSeries,
      ma1: ma1Series,
      ma2: ma2Series,
      ma3: ma3Series,
      bbUpper: bbUpperSeries,
      bbLower: bbLowerSeries,
      volume: volumeSeries,
      rsi: rsiSeries,
      rsiMa: rsiMaSeries,
      rsiUpper,
      rsiLower,
      macd: macdSeries,
      macdSignal: macdSignalSeries,
      macdHist: macdHistSeries,
    };

    const panes = chart.panes();
    panes[0]?.setStretchFactor(5);
    panes[1]?.setStretchFactor(1.1);
    if (panes[2]) panes[2].setStretchFactor(1.3);
    if (panes[3]) panes[3].setStretchFactor(1.3);

    return () => {
      chart.remove();
      chartRef.current = null;
      markersPluginRef.current = null;
      srLinesRef.current = [];
      breakEvenLineRef.current = null;
    };
  }, []);

  // push data
  useEffect(() => {
    if (!candles || !computed || !chartRef.current) return;
    const s = seriesRef.current;
    const times = candles.t as number[];

    const candleData = times.map((t, i) => ({
      time: t as UTCTimestamp,
      open: candles.o[i],
      high: candles.h[i],
      low: candles.l[i],
      close: candles.c[i],
    }));
    s.candle.setData(candleData);

    const line = (arr: (number | null)[]) =>
      times
        .map((t, i) => ({ time: t as UTCTimestamp, value: arr[i] }))
        .filter((d): d is { time: UTCTimestamp; value: number } => d.value !== null);

    s.ma1.setData(showMa1 ? line(computed.ma1) : []);
    s.ma2.setData(showMa2 ? line(computed.ma2) : []);
    s.ma3.setData(showMa3 ? line(computed.ma3) : []);
    s.bbUpper.setData(showBollinger ? line(computed.bb.upper) : []);
    s.bbLower.setData(showBollinger ? line(computed.bb.lower) : []);

    s.volume.setData(
      times.map((t, i) => ({
        time: t as UTCTimestamp,
        value: candles.v[i],
        color: candles.c[i] >= candles.o[i] ? "rgba(63,196,216,0.7)" : "rgba(63,196,216,0.28)",
      }))
    );

    s.rsi.setData(showRsi ? line(computed.rsi) : []);
    s.rsiMa.setData(showRsi && showRsiMa ? line(computed.rsiMa) : []);
    s.rsiUpper.setData(
      showRsi ? times.map((t) => ({ time: t as UTCTimestamp, value: 70 })) : []
    );
    s.rsiLower.setData(
      showRsi ? times.map((t) => ({ time: t as UTCTimestamp, value: 30 })) : []
    );

    s.macd.setData(showMacd ? line(computed.macd.macd) : []);
    s.macdSignal.setData(showMacd ? line(computed.macd.signal) : []);
    s.macdHist.setData(
      showMacd
        ? times
            .map((t, i) => ({
              time: t as UTCTimestamp,
              value: computed.macd.histogram[i],
              color: (computed.macd.histogram[i] ?? 0) >= 0 ? "rgba(52,209,124,0.6)" : "rgba(239,91,91,0.6)",
            }))
            .filter((d) => d.value !== null)
        : []
    );

    srLinesRef.current.forEach((l) => s.candle.removePriceLine(l));
    srLinesRef.current = [];
    if (showSR) {
      for (const level of computed.sr) {
        const isResistance = level.type === "resistance";
        srLinesRef.current.push(
          s.candle.createPriceLine({
            price: level.price,
            color: isResistance ? "rgba(239,91,91,0.7)" : "rgba(52,209,124,0.7)",
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: isResistance ? "แนวต้าน" : "แนวรับ",
          })
        );
      }
    }

    if (breakEvenLineRef.current) {
      s.candle.removePriceLine(breakEvenLineRef.current);
      breakEvenLineRef.current = null;
    }
    if (showBreakEven && position) {
      breakEvenLineRef.current = s.candle.createPriceLine({
        price: position.avgCost,
        color: "#e8ecf1",
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "ต้นทุนเฉลี่ยของฉัน",
      });
    }

    const markers: SeriesMarker<Time>[] = showStructure
      ? computed.structure.map((event) => ({
          time: event.time as UTCTimestamp,
          position: event.direction === "up" ? "belowBar" : "aboveBar",
          shape: event.direction === "up" ? "arrowUp" : "arrowDown",
          color: event.kind === "CHoCH" ? CH.choch : event.direction === "up" ? CH.up : CH.down,
          text: event.kind,
        }))
      : [];
    markersPluginRef.current?.setMarkers(markers);
  }, [
    candles,
    computed,
    showMa1,
    showMa2,
    showMa3,
    showBollinger,
    showRsi,
    showRsiMa,
    showMacd,
    showSR,
    showStructure,
    showBreakEven,
    position,
  ]);

  // Scope the default view to what the selected tab means (e.g. "1D" opens on the last
  // day) without discarding the rest of the fetched history — zooming/panning out still
  // reveals everything the fetch above pulled in, all the way back to IPO where available.
  useEffect(() => {
    if (!candles || !chartRef.current) return;
    const times = candles.t;
    if (times.length === 0) return;

    const tf = TIMEFRAMES.find((t) => t.key === timeframe);
    const lastTime = times[times.length - 1];
    let fromTime: number;
    if (tf?.scopeDays === "ytd") {
      const lastDate = new Date(lastTime * 1000);
      fromTime = Date.UTC(lastDate.getUTCFullYear(), 0, 1) / 1000;
    } else if (tf) {
      fromTime = lastTime - tf.scopeDays * 24 * 60 * 60;
    } else {
      fromTime = times[0];
    }

    chartRef.current.timeScale().setVisibleRange({
      from: Math.max(fromTime, times[0]) as UTCTimestamp,
      to: lastTime as UTCTimestamp,
    });
  }, [candles, timeframe]);

  const panesVisible = 2 + (showRsi ? 1 : 0) + (showMacd ? 1 : 0);

  return (
    <div className="module flex flex-col">
      <div className="relative flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-seam px-4 py-2.5">
        <div className="flex items-center gap-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.key}
              onClick={() => setTimeframe(tf.key)}
              className={`telemetry rounded px-2 py-1 text-[11px] transition-colors ${
                timeframe === tf.key
                  ? "bg-ch-price-dim text-ch-price"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {tf.key}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11px]">
          <Toggle label={`MA${params.ma1}`} color={CH.price} active={showMa1} onClick={() => setShowMa1((v) => !v)} />
          <Toggle label={`MA${params.ma2}`} color="#8fb8ff" active={showMa2} onClick={() => setShowMa2((v) => !v)} />
          <Toggle label={`MA${params.ma3}`} color="#ff9f6e" active={showMa3} onClick={() => setShowMa3((v) => !v)} />
          <Toggle label="Bollinger" color="#9aa4b2" active={showBollinger} onClick={() => setShowBollinger((v) => !v)} />
          <Toggle label={`RSI ${params.rsiPeriod}`} color={CH.rsi} active={showRsi} onClick={() => setShowRsi((v) => !v)} />
          <Toggle label={`RSI MA${params.rsiMaPeriod}`} color={CH.rsiMa} active={showRsiMa} onClick={() => setShowRsiMa((v) => !v)} />
          <Toggle label="MACD" color={CH.macd} active={showMacd} onClick={() => setShowMacd((v) => !v)} />
          <Toggle label="แนวรับ/แนวต้าน" color="#9aa4b2" active={showSR} onClick={() => setShowSR((v) => !v)} />
          <Toggle label="BOS/CHoCH" color={CH.choch} active={showStructure} onClick={() => setShowStructure((v) => !v)} />
          {position && (
            <Toggle
              label="ต้นทุนเฉลี่ย"
              color="#e8ecf1"
              active={showBreakEven}
              onClick={() => setShowBreakEven((v) => !v)}
            />
          )}
        </div>

        <details className="ml-auto text-[11px] text-text-muted">
          <summary className="cursor-pointer select-none hover:text-text-secondary">ตัวชี้วัด</summary>
          <div className="absolute right-4 mt-2 module p-3 flex flex-col gap-2 z-30">
            <ParamField label="MA เร็ว" value={params.ma1} onChange={(v) => setParams((p) => ({ ...p, ma1: v }))} />
            <ParamField label="MA กลาง" value={params.ma2} onChange={(v) => setParams((p) => ({ ...p, ma2: v }))} />
            <ParamField label="MA ช้า" value={params.ma3} onChange={(v) => setParams((p) => ({ ...p, ma3: v }))} />
            <ParamField label="Bollinger คาบ" value={params.bbPeriod} onChange={(v) => setParams((p) => ({ ...p, bbPeriod: v }))} />
            <ParamField label="RSI คาบ" value={params.rsiPeriod} onChange={(v) => setParams((p) => ({ ...p, rsiPeriod: v }))} />
            <ParamField label="RSI MA คาบ" value={params.rsiMaPeriod} onChange={(v) => setParams((p) => ({ ...p, rsiMaPeriod: v }))} />
            <ParamField label="ช่วงยืนยันจุดกลับตัว" value={params.swingBars} onChange={(v) => setParams((p) => ({ ...p, swingBars: v }))} />
          </div>
        </details>
      </div>

      <div className="relative" style={{ height: 200 + panesVisible * 130 }}>
        <div ref={containerRef} className="absolute inset-0" />
        {status === "loading" && <ChartOverlay text="กำลังโหลดข้อมูลราคา…" />}
        {status === "no_key" && (
          <ChartOverlay text="ยังไม่ได้ตั้งค่า FINNHUB_API_KEY — ใส่คีย์ใน .env.local แล้วรีสตาร์ทเซิร์ฟเวอร์" />
        )}
        {status === "error" && <ChartOverlay text="โหลดข้อมูลราคาไม่สำเร็จ ลองรีเฟรชอีกครั้ง" />}
      </div>
    </div>
  );
}

function Toggle({
  label,
  color,
  active,
  onClick,
}: {
  label: string;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 telemetry rounded px-1.5 py-1 transition-opacity"
      style={{ opacity: active ? 1 : 0.4 }}
    >
      <span className="h-2 w-2 rounded-sm" style={{ background: color }} />
      <span className={active ? "text-text-secondary" : "text-text-muted"}>{label}</span>
    </button>
  );
}

function ParamField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-text-muted">
      {label}
      <input
        type="number"
        value={value}
        min={2}
        max={400}
        onChange={(e) => onChange(Number(e.target.value) || value)}
        className="telemetry w-14 rounded border border-seam bg-panel-2 px-1.5 py-0.5 text-right text-text-primary"
      />
    </label>
  );
}

function ChartOverlay({ text }: { text: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-panel/80 px-6 text-center text-xs text-text-muted">
      {text}
    </div>
  );
}
