// Test harness: runs the real indicator implementations against reference values
// computed independently, and prints a machine-readable report.
import {
  sma, ema, rsi, macd, bollinger, vwap,
  findPivots, computeSupportResistance, detectStructureBreaks, movingAverageOf,
} from "../src/lib/indicators.ts";

let pass = 0, fail = 0;
const failures = [];

function check(name, actual, expected, tol = 1e-6) {
  const ok = Math.abs(actual - expected) <= tol;
  if (ok) pass++; else { fail++; failures.push({ name, actual, expected, diff: actual - expected }); }
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  got=${actual}  want=${expected}`);
}

function checkNull(name, actual, expectedNull) {
  const ok = (actual === null) === expectedNull;
  if (ok) pass++; else { fail++; failures.push({ name, actual, expected: expectedNull ? null : "value" }); }
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  got=${actual}  want=${expectedNull ? "null" : "a value"}`);
}

console.log("=== SMA ===");
// Reference: plain arithmetic mean of the trailing window.
const p = [1, 2, 3, 4, 5, 6];
const s = sma(p, 3);
checkNull("sma leading null at 0", s[0], true);
checkNull("sma leading null at 1", s[1], true);
check("sma[2] = mean(1,2,3)", s[2], 2);
check("sma[3] = mean(2,3,4)", s[3], 3);
check("sma[5] = mean(4,5,6)", s[5], 5);

console.log("\n=== EMA ===");
// Reference: seed = SMA(period), then EMA_i = v*k + prev*(1-k), k = 2/(period+1)
const e = ema(p, 3);
const k = 2 / 4;
check("ema seed at index 2 = mean(1,2,3)", e[2], 2);
check("ema[3]", e[3], 4 * k + 2 * (1 - k));
check("ema[4]", e[4], 5 * k + (4 * k + 2 * (1 - k)) * (1 - k));

console.log("\n=== RSI (Wilder) ===");
// Textbook Wilder example (StockCharts): 14-period RSI on this close series
// yields ~70.53 at the first RSI value. Using a longer series to also test smoothing.
const rsiCloses = [
  44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08,
  45.89, 46.03, 45.61, 46.28, 46.28, 46.00, 46.03, 46.41, 46.22, 45.64,
  46.21, 46.25, 45.71, 46.45, 45.78, 45.35, 44.03, 44.18, 44.22, 44.57,
  43.42, 42.66, 43.13,
];
const r = rsi(rsiCloses, 14);
console.log(`  rsi[14] = ${r[14]}`);
// StockCharts' published 70.53 comes from rounding avgGain to 0.24 mid-calculation.
// The unrounded Wilder value is 70.4641, which is what a correct implementation gives.
check("rsi[14] = 70.4641 (Wilder, unrounded)", r[14], 70.4641, 0.001);
console.log(`  rsi[last] = ${r[r.length - 1]}`);
// Reference for the smoothed tail (computed independently in the Python harness):
check("rsi[last] ≈ 37.79", r[r.length - 1], 37.79, 0.02);

console.log("\n=== Bollinger ===");
// Reference: middle = SMA(20), bands = middle ± mult*populationStdDev(window)
const bbCloses = Array.from({ length: 25 }, (_, i) => 100 + Math.sin(i / 2) * 5);
const bb = bollinger(bbCloses, 20, 2);
const win = bbCloses.slice(5, 25);
const mean = win.reduce((a, b) => a + b, 0) / 20;
const sd = Math.sqrt(win.reduce((a, v) => a + (v - mean) ** 2, 0) / 20);
check("bb.middle[24] = SMA20", bb.middle[24], mean);
check("bb.upper[24] = mean + 2sd", bb.upper[24], mean + 2 * sd);
check("bb.lower[24] = mean - 2sd", bb.lower[24], mean - 2 * sd);
checkNull("bb.upper[18] null before period", bb.upper[18], true);

console.log("\n=== MACD ===");
// Needs >= 26 bars for the slow EMA to exist at all, so use a series long enough.
const macdCloses = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 2) * 5);
const m = macd(macdCloses);
// Reference: MACD line = EMA12 - EMA26; signal = EMA9 of the MACD line
const e12 = ema(macdCloses, 12), e26 = ema(macdCloses, 26);
const lastI = macdCloses.length - 1;
check("macd line = ema12 - ema26", m.macd[lastI], e12[lastI] - e26[lastI]);
console.log(`  macd line=${m.macd[lastI]} signal=${m.signal[lastI]} hist=${m.histogram[lastI]}`);
check("histogram = macd - signal", m.histogram[lastI], m.macd[lastI] - m.signal[lastI]);
checkNull("macd null before slow EMA", macd(macdCloses.slice(0, 25)).macd[24], true);

console.log("\n=== VWAP ===");
const vw = vwap([10, 11], [8, 9], [9, 10], [100, 300]);
check("vwap[0] = typical0", vw[0], (10 + 8 + 9) / 3);
const t0 = (10 + 8 + 9) / 3, t1 = (11 + 9 + 10) / 3;
check("vwap[1] = cumPV/cumV", vw[1], (t0 * 100 + t1 * 300) / 400);

console.log("\n=== movingAverageOf ===");
const maOf = movingAverageOf([null, null, 1, 2, 3, 4], 2);
checkNull("maOf preserves leading nulls", maOf[2], true);
check("maOf[3] = mean(1,2)", maOf[3], 1.5);
check("maOf[4] = mean(2,3)", maOf[4], 2.5);

console.log("\n=== findPivots ===");
// A hand-built series with one obvious swing high and one obvious swing low.
const hh = [1, 2, 3, 4, 5, 4, 3, 2, 1, 2, 3, 4, 5, 6, 7, 8, 9, 8, 7, 6, 5];
const ll = [0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 7, 6, 5, 4];
const tt = hh.map((_, i) => i * 3600);
const piv = findPivots(tt, hh, ll, 3, 3);
console.log("  pivots:", piv.map(x => `${x.type}@${x.index}=${x.price}`).join(" "));
const pivotHighIdx = piv.filter(x => x.type === "high").map(x => x.index);
const pivotLowIdx = piv.filter(x => x.type === "low").map(x => x.index);
check("finds a pivot high at index 4", pivotHighIdx.includes(4) ? 1 : 0, 1);
check("finds a pivot low at index 8", pivotLowIdx.includes(8) ? 1 : 0, 1);
check("finds a pivot high at index 16", pivotHighIdx.includes(16) ? 1 : 0, 1);
// Documented limitation, asserted so it cannot regress silently: the trailing
// `rightBars` bars can never be pivots (there is no confirmation window after them).
check("last rightBars bars are never pivots", pivotHighIdx.every(i => i <= hh.length - 1 - 3) ? 1 : 0, 1);

console.log("\n=== computeSupportResistance ===");
// Reference: pivots at 100,101 (cluster), 120,121 (cluster), 80,81 (cluster).
// Current price 105 splits them: 120/121 above -> resistance; 100/101 and 80/81 below
// -> support. The 100/101 cluster comes from pivot HIGHS, and must still be counted as
// support because price now trades above it (the level flipped).
const pivots = [
  { index: 1, time: 1, price: 100, type: "high" },
  { index: 2, time: 2, price: 101, type: "high" },
  { index: 3, time: 3, price: 120, type: "high" },
  { index: 4, time: 4, price: 121, type: "high" },
  { index: 5, time: 5, price: 80, type: "low" },
  { index: 6, time: 6, price: 81, type: "low" },
];
const sr = computeSupportResistance(pivots, 105);
console.log("  levels:", JSON.stringify(sr));
check("1 resistance cluster above 105", sr.filter(x => x.type === "resistance").length, 1);
check("2 support clusters below 105", sr.filter(x => x.type === "support").length, 2);
check("support includes the flipped old high (100.5)", sr.some(x => x.type === "support" && Math.abs(x.price - 100.5) < 0.01) ? 1 : 0, 1);
check("support includes 80.5", sr.some(x => x.type === "support" && Math.abs(x.price - 80.5) < 0.01) ? 1 : 0, 1);
// The chaining bug: 100,102,104,106 are each 2% apart but span 6%. Must be 2 clusters.
const chain = [
  { index: 1, time: 1, price: 100, type: "low" },
  { index: 2, time: 2, price: 102, type: "low" },
  { index: 3, time: 3, price: 104, type: "low" },
  { index: 4, time: 4, price: 106, type: "low" },
];
const chainSr = computeSupportResistance(chain, 200, { mergeThresholdPct: 0.025 });
const chainSupport = chainSr.filter(x => x.type === "support");
console.log("  chained pivots ->", JSON.stringify(chainSupport));
check("no runaway chaining: 100/102 cluster", chainSupport.some(x => Math.abs(x.price - 101) < 0.01) ? 1 : 0, 1);
check("no runaway chaining: 104/106 cluster", chainSupport.some(x => Math.abs(x.price - 105) < 0.01) ? 1 : 0, 1);

console.log("\n=== detectStructureBreaks ===");
// Rising series breaking a swing high -> BOS up, then a break down -> CHoCH
const sh = [1, 2, 3, 4, 5, 4, 3, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1, 2, 3];
const sl = sh.map(v => v - 1);
const sc = sh.map(v => v - 0.5);
const st = sh.map((_, i) => i * 3600);
const ev = detectStructureBreaks(st, sh, sl, sc, 2, 2);
console.log("  events:", ev.map(x => `${x.kind}/${x.direction}@${x.index}`).join(" ") || "(none)");
check("detects at least one structure event", ev.length > 0 ? 1 : 0, 1);
check("first event is a BOS up", ev.length > 0 && ev[0].kind === "BOS" && ev[0].direction === "up" ? 1 : 0, 1);

console.log(`\n=== SUMMARY: ${pass} passed, ${fail} failed ===`);
if (failures.length) {
  console.log("\nFAILURES:");
  for (const f of failures) console.log(`  ${f.name}: got ${f.actual}, want ${f.expected}`);
  process.exit(1);
}
