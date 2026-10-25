// Walk-forward backtest of the technical half of the analysis read.
//
//   node scripts/backtest-technical.mjs
//
// For every bar of ~10 years of daily candles, per heatmap-universe symbol, it builds the same
// TechnicalInputs the dashboard builds (using only data up to that bar) and scores it with the
// real buildTechnicalRead(), then compares the score with what the price did next.
//
// What this can and cannot say:
//  - Technical side only. Finnhub serves today's fundamentals, not point-in-time ones, so the
//    fundamental score and the combined verdict cannot be backtested honestly.
//  - The universe is today's large caps, i.e. survivors, which lifts every forward return.
//    Read differences between groups, not the absolute returns.
//  - Bars are sampled every SAMPLE_EVERY days and symbols move together, so the effective
//    sample is far smaller than the printed n. The t-stats are optimistic; treat |t| < 3 as noise.
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = mkdtempSync(path.join(tmpdir(), "backtest-"));
// analysis.ts imports extensionless siblings, which Node's type stripping can't resolve, so
// compile it (and what it pulls in) first, then load the result.
execFileSync(
  "npx",
  [
    "tsc", "src/lib/analysis.ts", "src/lib/heatmap-universe.ts",
    "--outDir", out, "--module", "commonjs", "--target", "es2020",
    "--moduleResolution", "node", "--skipLibCheck", "--esModuleInterop",
  ],
  { cwd: root, stdio: "inherit" }
);
const require = createRequire(import.meta.url);
const { buildTechnicalRead, deriveDailyContext } = require(path.join(out, "analysis.js"));
const { HEATMAP_UNIVERSE } = require(path.join(out, "heatmap-universe.js"));
const { getYahooCandles } = require(path.join(out, "yahoo.js"));
const { rsi, macd, sma, bollinger } = require(path.join(out, "indicators.js"));

const WARMUP = 250; // MA200 plus settling room for the smoothed indicators
const WINDOW = 320; // trailing bars handed to deriveDailyContext (>= 30 weeks, > ATR warmup)
const SAMPLE_EVERY = 5;
const HORIZONS = [5, 20];

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
function pearson(xs, ys) {
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < xs.length; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxy / Math.sqrt(sxx * syy);
}
// Overlap between consecutive samples shrinks the effective n by horizon / SAMPLE_EVERY.
function tStat(r, n, horizon) {
  const nEff = n / Math.max(1, horizon / SAMPLE_EVERY);
  return r * Math.sqrt((nEff - 2) / (1 - r * r));
}

const samples = [];
const symbols = [...new Set(HEATMAP_UNIVERSE.map((u) => u.symbol))];
for (const symbol of symbols) {
  let candles;
  try {
    candles = await getYahooCandles(symbol, "10y", "1d");
  } catch (err) {
    console.error(`skip ${symbol}: ${err.message}`);
    continue;
  }
  const { t, h, l, c, v } = candles;
  const n = c.length;
  if (n < WARMUP + 40) continue;

  const rsiS = rsi(c, 14), macdS = macd(c), bb = bollinger(c, 20);
  const m20 = sma(c, 20), m50 = sma(c, 50), m200 = sma(c, 200);

  for (let i = WARMUP; i + Math.max(...HORIZONS) < n; i += SAMPLE_EVERY) {
    const from = Math.max(0, i - WINDOW);
    const slice = {
      s: "ok", t: t.slice(from, i + 1), o: [], h: h.slice(from, i + 1),
      l: l.slice(from, i + 1), c: c.slice(from, i + 1), v: v.slice(from, i + 1),
    };
    const ctx = deriveDailyContext(slice, c[i]);
    const hist = macdS.histogram;
    const base = {
      price: c[i], rsi: rsiS[i], macd: macdS.macd[i], macdSignal: macdS.signal[i],
      macdHistPrev: hist[i - 1] ?? null, macdHistLast: hist[i] ?? null,
      ma20: m20[i], ma50: m50[i], ma200: m200[i],
      bollingerUpper: bb.upper[i], bollingerLower: bb.lower[i],
    };
    const row = {
      symbol, i,
      full: buildTechnicalRead({ ...base, ...ctx }).score,
      // Same read with the volume / ATR / weekly inputs withheld. Those inputs only add context
      // lines today, so the two should match exactly; a gap means one of them started scoring.
      base: buildTechnicalRead(base).score,
      rsi: base.rsi,
      uptrend: base.ma50 !== null && base.ma200 !== null && c[i] > base.ma50 && base.ma50 > base.ma200,
      downtrend: base.ma50 !== null && base.ma200 !== null && c[i] < base.ma50 && base.ma50 < base.ma200,
      ...ctx,
    };
    for (const hz of HORIZONS) row[`f${hz}`] = c[i + hz] / c[i] - 1;
    samples.push(row);
  }
  console.error(`loaded ${symbol} (${n} bars)`);
}

const pct = (x) => `${(x * 100 >= 0 ? "+" : "")}${(x * 100).toFixed(2)}%`;
const win = (xs) => `${((xs.filter((x) => x > 0).length / xs.length) * 100).toFixed(1)}%`;

console.log(`\n${samples.length} samples from ${symbols.length} symbols, every ${SAMPLE_EVERY} bars`);
for (const hz of HORIZONS) {
  const all = samples.map((s) => s[`f${hz}`]);
  console.log(`\n=== Forward ${hz}-day return — baseline (all samples): mean ${pct(mean(all))}, up ${win(all)} ===`);

  console.log("\nscore bucket (full read)           n      mean      vs base   up%");
  const buckets = [
    ["<= -2", (s) => s <= -2], ["(-2, -0.5]", (s) => s > -2 && s <= -0.5],
    ["(-0.5, 0.5)", (s) => s > -0.5 && s < 0.5], ["[0.5, 2)", (s) => s >= 0.5 && s < 2],
    [">= 2", (s) => s >= 2],
  ];
  for (const [label, test] of buckets) {
    const xs = samples.filter((s) => test(s.full)).map((s) => s[`f${hz}`]);
    if (xs.length < 30) { console.log(`${label.padEnd(30)} ${String(xs.length).padStart(6)}   (too few)`); continue; }
    console.log(`${label.padEnd(30)} ${String(xs.length).padStart(6)}  ${pct(mean(xs)).padStart(8)}  ${pct(mean(xs) - mean(all)).padStart(8)}  ${win(xs).padStart(6)}`);
  }

  const fwd = samples.map((s) => s[`f${hz}`]);
  for (const key of ["base", "full"]) {
    const r = pearson(samples.map((s) => s[key]), fwd);
    console.log(`corr(${key.padEnd(4)} score, fwd${hz}) = ${r.toFixed(4)}   t≈${tStat(r, samples.length, hz).toFixed(2)} (optimistic)`);
  }

  // Candidate conditions, kept so a proposed rule can be checked here before it is given a
  // score. None of these carry a score in the live read except plain RSI >= 70 / <= 30.
  console.log("\ncondition check                                  n      mean   up%");
  const groups = [
    ["RSI>=70 (scored -1)", (s) => s.rsi >= 70],
    ["RSI>=70, in daily uptrend", (s) => s.rsi >= 70 && s.uptrend],
    ["RSI>=70, not in uptrend", (s) => s.rsi >= 70 && !s.uptrend],
    ["RSI<=30 (scored +1)", (s) => s.rsi <= 30],
    ["RSI<=30, in daily downtrend", (s) => s.rsi <= 30 && s.downtrend],
    ["RSI<=30, not in downtrend", (s) => s.rsi <= 30 && !s.downtrend],
    ["volume>=1.5x, up day", (s) => s.volumeRatio >= 1.5 && s.lastDayChangePct >= 0.5],
    ["volume>=1.5x, down day", (s) => s.volumeRatio >= 1.5 && s.lastDayChangePct <= -0.5],
    ["weekly up   & daily uptrend", (s) => s.weeklyTrend === "up" && s.uptrend],
    ["weekly down & daily downtrend", (s) => s.weeklyTrend === "down" && s.downtrend],
    ["weekly up   & daily downtrend", (s) => s.weeklyTrend === "up" && s.downtrend],
    ["weekly down & daily uptrend", (s) => s.weeklyTrend === "down" && s.uptrend],
    ["ATR >= 4% of price (high volatility)", (s) => s.atrPct >= 4],
  ];
  for (const [label, test] of groups) {
    const xs = samples.filter(test).map((s) => s[`f${hz}`]);
    if (xs.length < 30) { console.log(`${label.padEnd(40)} ${String(xs.length).padStart(5)}   (too few)`); continue; }
    console.log(`${label.padEnd(40)} ${String(xs.length).padStart(5)}  ${pct(mean(xs)).padStart(8)}  ${win(xs).padStart(6)}`);
  }
}
