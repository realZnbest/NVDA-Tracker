export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  const k = 2 / (period + 1);
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (i === period - 1) {
      const seed = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
      prev = seed;
      out[i] = seed;
    } else if (i >= period) {
      prev = values[i] * k + (prev as number) * (1 - k);
      out[i] = prev;
    }
  }
  return out;
}

export function rsi(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length <= period) return out;

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const change = values[i] - values[i - 1];
    if (change >= 0) gainSum += change;
    else lossSum -= change;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export interface MacdResult {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
}

export function macd(
  values: number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9
): MacdResult {
  const fastEma = ema(values, fast);
  const slowEma = ema(values, slow);
  const macdLine: (number | null)[] = values.map((_, i) => {
    const f = fastEma[i];
    const s = slowEma[i];
    return f !== null && s !== null ? f - s : null;
  });

  const firstValid = macdLine.findIndex((v) => v !== null);
  const signal: (number | null)[] = new Array(values.length).fill(null);
  if (firstValid >= 0) {
    const compact = macdLine.slice(firstValid).map((v) => v as number);
    const compactSignal = ema(compact, signalPeriod);
    compactSignal.forEach((v, i) => {
      signal[firstValid + i] = v;
    });
  }

  const histogram: (number | null)[] = macdLine.map((v, i) => {
    const s = signal[i];
    return v !== null && s !== null ? v - s : null;
  });

  return { macd: macdLine, signal, histogram };
}

export interface BollingerResult {
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
}

export function bollinger(
  values: number[],
  period = 20,
  stdDevMultiplier = 2
): BollingerResult {
  const middle = sma(values, period);
  const upper: (number | null)[] = new Array(values.length).fill(null);
  const lower: (number | null)[] = new Array(values.length).fill(null);

  for (let i = period - 1; i < values.length; i++) {
    const window = values.slice(i - period + 1, i + 1);
    const mean = middle[i] as number;
    const variance =
      window.reduce((acc, v) => acc + (v - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    upper[i] = mean + stdDevMultiplier * sd;
    lower[i] = mean - stdDevMultiplier * sd;
  }

  return { upper, middle, lower };
}

/** Volume-weighted average price, cumulative from the start of the series window. */
export function vwap(
  high: number[],
  low: number[],
  close: number[],
  volume: number[]
): (number | null)[] {
  const out: (number | null)[] = new Array(close.length).fill(null);
  let cumPV = 0;
  let cumV = 0;
  for (let i = 0; i < close.length; i++) {
    const typical = (high[i] + low[i] + close[i]) / 3;
    cumPV += typical * volume[i];
    cumV += volume[i];
    out[i] = cumV === 0 ? null : cumPV / cumV;
  }
  return out;
}

export function lastValid(values: (number | null)[]): number | null {
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i] !== null) return values[i];
  }
  return null;
}

/** Moving average of a series that already has leading nulls (e.g. an RSI line), keeping the same alignment. */
export function movingAverageOf(
  series: (number | null)[],
  period: number,
  kind: "sma" | "ema" = "sma"
): (number | null)[] {
  const firstValid = series.findIndex((v) => v !== null);
  const out: (number | null)[] = new Array(series.length).fill(null);
  if (firstValid === -1) return out;
  const compact = series.slice(firstValid).map((v) => v as number);
  const maCompact = kind === "sma" ? sma(compact, period) : ema(compact, period);
  maCompact.forEach((v, i) => {
    out[firstValid + i] = v;
  });
  return out;
}

export interface PivotPoint {
  index: number;
  time: number;
  price: number;
  type: "high" | "low";
}

/**
 * Fractal-style swing points: a bar is a pivot high/low when its high/low is the most
 * extreme within `leftBars` bars before and `rightBars` bars after it.
 */
export function findPivots(
  time: number[],
  high: number[],
  low: number[],
  leftBars = 5,
  rightBars = 5
): PivotPoint[] {
  const pivots: PivotPoint[] = [];
  for (let i = leftBars; i < high.length - rightBars; i++) {
    const windowHigh = high.slice(i - leftBars, i + rightBars + 1);
    if (high[i] === Math.max(...windowHigh)) {
      pivots.push({ index: i, time: time[i], price: high[i], type: "high" });
    }
    const windowLow = low.slice(i - leftBars, i + rightBars + 1);
    if (low[i] === Math.min(...windowLow)) {
      pivots.push({ index: i, time: time[i], price: low[i], type: "low" });
    }
  }
  return pivots;
}

export interface SRLevel {
  price: number;
  type: "support" | "resistance";
  touches: number;
}

/**
 * Clusters nearby swing pivots into support/resistance levels, scored by how many
 * pivots landed near that price (more touches = a stronger level), keeping the
 * levels closest to the current price.
 */
export function computeSupportResistance(
  pivots: PivotPoint[],
  currentPrice: number,
  opts: { maxLevels?: number; mergeThresholdPct?: number } = {}
): SRLevel[] {
  const maxLevels = opts.maxLevels ?? 3;
  const mergeThresholdPct = opts.mergeThresholdPct ?? 0.015;

  function clusterPrices(prices: number[]): { price: number; touches: number }[] {
    const sorted = [...prices].sort((a, b) => a - b);
    const clusters: number[][] = [];
    for (const p of sorted) {
      const last = clusters[clusters.length - 1];
      if (last && p - last[last.length - 1] <= last[last.length - 1] * mergeThresholdPct) {
        last.push(p);
      } else {
        clusters.push([p]);
      }
    }
    return clusters.map((c) => ({
      price: c.reduce((a, b) => a + b, 0) / c.length,
      touches: c.length,
    }));
  }

  const highs = clusterPrices(pivots.filter((p) => p.type === "high").map((p) => p.price));
  const lows = clusterPrices(pivots.filter((p) => p.type === "low").map((p) => p.price));

  const resistance = highs
    .filter((c) => c.price > currentPrice)
    .sort((a, b) => b.touches - a.touches || a.price - b.price)
    .slice(0, maxLevels)
    .map((c) => ({ price: c.price, type: "resistance" as const, touches: c.touches }));

  const support = lows
    .filter((c) => c.price < currentPrice)
    .sort((a, b) => b.touches - a.touches || b.price - a.price)
    .slice(0, maxLevels)
    .map((c) => ({ price: c.price, type: "support" as const, touches: c.touches }));

  return [...resistance, ...support];
}

export interface StructureEvent {
  index: number;
  time: number;
  price: number;
  kind: "BOS" | "CHoCH";
  direction: "up" | "down";
}

/**
 * Break of Structure (continuation past the last unbroken swing point in the
 * prevailing direction) vs Change of Character (a break in the opposite direction,
 * signaling a possible trend reversal). Derived from confirmed swing pivots.
 */
export function detectStructureBreaks(
  time: number[],
  high: number[],
  low: number[],
  close: number[],
  leftBars = 5,
  rightBars = 5
): StructureEvent[] {
  const pivots = findPivots(time, high, low, leftBars, rightBars);
  const events: StructureEvent[] = [];

  let swingHigh: PivotPoint | null = null;
  let swingLow: PivotPoint | null = null;
  let trend: "up" | "down" | null = null;
  let pivotPointer = 0;

  for (let i = 0; i < close.length; i++) {
    while (pivotPointer < pivots.length && pivots[pivotPointer].index === i) {
      const p = pivots[pivotPointer];
      // Always track the most recent unbroken swing point of each type — not the
      // extreme one since the last break — so structure updates stay responsive
      // to the latest price action rather than chasing an old extreme.
      if (p.type === "high") {
        swingHigh = p;
      } else {
        swingLow = p;
      }
      pivotPointer++;
    }

    if (swingHigh && close[i] > swingHigh.price) {
      events.push({
        index: i,
        time: time[i],
        price: swingHigh.price,
        kind: trend === "down" ? "CHoCH" : "BOS",
        direction: "up",
      });
      trend = "up";
      swingHigh = null;
    }
    if (swingLow && close[i] < swingLow.price) {
      events.push({
        index: i,
        time: time[i],
        price: swingLow.price,
        kind: trend === "up" ? "CHoCH" : "BOS",
        direction: "down",
      });
      trend = "down";
      swingLow = null;
    }
  }

  return events;
}
