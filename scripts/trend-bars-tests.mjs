// Geometry tests for the quarterly trend bars. Run with: node scripts/trend-bars-tests.mjs
import { computeBarGeometry } from "../src/lib/trend-bars-geometry.ts";

const HEIGHT = 46;
let pass = 0;
let fail = 0;
const failures = [];

function check(name, ok, detail = "") {
  if (ok) {
    pass++;
    console.log(`PASS  ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`FAIL  ${name} ${detail}`);
  }
}

const bottomOf = (bar) => bar.y + bar.height;

console.log("=== all-positive series: bars stand on the bottom baseline ===");
{
  const g = computeBarGeometry([1, 2, 3, 4]);
  check("zero line at bottom", Math.abs(g.zeroY - HEIGHT) < 1e-6, `got ${g.zeroY}`);
  check(
    "every bar bottom-aligned",
    g.bars.every((b) => Math.abs(bottomOf(b) - HEIGHT) < 1e-6),
    g.bars.map((b) => bottomOf(b).toFixed(2)).join(",")
  );
}

console.log("\n=== all-negative series: must NOT hang from the top edge ===");
{
  const g = computeBarGeometry([-2, -5, -11.44, -1]);
  check(
    "zero line is not pinned to the top edge",
    g.zeroY > HEIGHT * 0.1,
    `got ${g.zeroY}`
  );
  check(
    "no bar hangs from the top edge",
    g.bars.every((b) => !(b.y < 0.1 && bottomOf(b) < HEIGHT - 0.1)),
    g.bars.map((b) => `y=${b.y.toFixed(2)} bottom=${bottomOf(b).toFixed(2)}`).join(", ")
  );
  check(
    "every bar stands on the bottom baseline",
    g.bars.every((b) => Math.abs(bottomOf(b) - HEIGHT) < 1e-6),
    g.bars.map((b) => bottomOf(b).toFixed(2)).join(",")
  );
}

console.log("\n=== mixed series: diverging around a visible zero line ===");
{
  const g = computeBarGeometry([10, -5, 20]);
  check("zero line inside the chart", g.zeroY > 0 && g.zeroY < HEIGHT, `got ${g.zeroY}`);
  check("positive bar grows upward", g.bars[0].y < g.zeroY, `got ${g.bars[0].y}`);
  check("negative bar grows downward", g.bars[1].y === g.zeroY, `got ${g.bars[1].y}`);
  check("no bar leaves the chart", g.bars.every((b) => b.y >= -1e-6 && bottomOf(b) <= HEIGHT + 1e-6));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log("Failures:", failures.join(" | "));
  process.exitCode = 1;
}
