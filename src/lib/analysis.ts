import { getBasicFinancials, getQuote, type FinnhubBasicFinancials } from "./finnhub";
import { mapWithConcurrency } from "./concurrency";
import { HEATMAP_UNIVERSE, sectorLabel } from "./heatmap-universe";
import { getYahooCandles } from "./yahoo";
import { SYMBOL, TIMEFRAMES, type TimeframeKey } from "./timeframes";
import { atr, bollinger, ema, lastValid, macd, rsi, sma, weeklyCloses } from "./indicators";
import type { FinnhubCandles } from "./finnhub";

export class AnalysisDataError extends Error {}

export interface TechnicalInputs {
  price: number;
  rsi: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHistPrev: number | null;
  macdHistLast: number | null;
  ma20: number | null;
  ma50: number | null;
  ma200: number | null;
  bollingerUpper: number | null;
  bollingerLower: number | null;
  /** Latest daily volume ÷ trailing 20-day average. Optional so callers without volume data
   *  (e.g. the daily summary) keep working — the volume read is simply skipped. */
  volumeRatio?: number | null;
  /** Latest daily close vs the previous close, in %. Gives the volume read a direction. */
  lastDayChangePct?: number | null;
  /** EMA20 / EMA50 of the timeframe being viewed (intraday tabs only — on daily bars the MA
   *  stack already covers this). Lets the read see the trend the chart is actually showing. */
  tfEmaFast?: number | null;
  tfEmaSlow?: number | null;
  /** 14-day ATR as a % of price — how far the stock typically travels in a day. */
  atrPct?: number | null;
  /** Trend of the weekly closes (price vs 10- and 30-week averages), for a multi-timeframe check. */
  weeklyTrend?: "up" | "down" | "mixed" | null;
}

export interface FundamentalInputs {
  peTTM: number | null;
  psTTM: number | null;
  netMarginTTM: number | null;
  grossMarginTTM: number | null;
  revenueGrowthYoY: number | null;
  epsGrowthYoY: number | null;
  week52High: number | null;
  week52Low: number | null;
  price: number;
  /** Share (0-100) of the last five years of quarter-end P/Es at or below the current P/E. */
  peHistoryPercentile?: number | null;
  peHistoryMedian?: number | null;
  /** Median P/E of the stock's sector peers, and that sector's Thai label for the sentence. */
  sectorPeMedian?: number | null;
  sectorLabel?: string | null;
}

export interface AnalysisRead {
  technical: string[];
  fundamental: string[];
  verdict: "bullish" | "bearish" | "neutral" | "mixed";
  verdictText: string;
  /** How strongly the technical and fundamental sides agree with each other — a measure of
   *  consistency between the signals, not of how likely the verdict is to play out (the
   *  backtest found no evidence the technical score predicts direction). */
  agreement: "high" | "medium" | "low";
  /** Plain-language notes on signals that pull against the overall read. Empty when the
   *  technical and fundamental sides don't disagree. */
  conflicts: string[];
}

/** A scored observation, kept so a conflict note can name the signal that drove each side. */
interface Driver {
  line: string;
  delta: number;
}

interface SideRead {
  lines: string[];
  score: number;
  drivers: Driver[];
}

/** Below this, a side's score is noise rather than a lean. */
const CONFLICT_MIN = 0.5;
/** Daily ATR above this share of price is flagged as high volatility (a warning line only). */
const HIGH_VOLATILITY_ATR_PCT = 4;

function pct(n: number) {
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function sideBuilder() {
  const lines: string[] = [];
  const drivers: Driver[] = [];
  let score = 0;
  return {
    lines,
    drivers,
    /** Records a line; a non-zero `delta` also moves the side's score and becomes a driver. */
    note(line: string, delta = 0) {
      lines.push(line);
      if (delta !== 0) {
        score += delta;
        drivers.push({ line, delta });
      }
    },
    result: (): SideRead => ({ lines, score, drivers }),
  };
}

export function buildTechnicalRead(
  input: TechnicalInputs,
  timeframeLabel: string = "รายวัน"
): SideRead {
  const { note, result } = sideBuilder();

  // Daily MA stack, used to describe how the weekly trend lines up with the daily one.
  const uptrend =
    input.ma50 !== null && input.ma200 !== null && input.price > input.ma50 && input.ma50 > input.ma200;
  const downtrend =
    input.ma50 !== null && input.ma200 !== null && input.price < input.ma50 && input.ma50 < input.ma200;

  if (input.rsi !== null) {
    if (input.rsi >= 70) {
      note(
        `RSI (${timeframeLabel}) อยู่ที่ ${input.rsi.toFixed(2)} เข้าเขตซื้อมากเกิน (Overbought) — โมเมนตัมแข็งแกร่งแต่เสี่ยงพักตัวระยะสั้น`,
        -1
      );
    } else if (input.rsi <= 30) {
      note(
        `RSI (${timeframeLabel}) อยู่ที่ ${input.rsi.toFixed(2)} เข้าเขตขายมากเกิน (Oversold) — แรงขายอาจเริ่มอ่อนแรงลง`,
        1
      );
    } else if (input.rsi >= 55) {
      note(
        `RSI (${timeframeLabel}) อยู่ที่ ${input.rsi.toFixed(2)} เอนไปทางฝั่งซื้อ สะท้อนแนวโน้มขาขึ้นที่ยังไม่ตึงตัวเกินไป`,
        0.5
      );
    } else if (input.rsi <= 45) {
      note(
        `RSI (${timeframeLabel}) อยู่ที่ ${input.rsi.toFixed(2)} เอนไปทางฝั่งขาย สะท้อนแรงกดดันขาลงที่ยังไม่ถึงจุดสุดขั้ว`,
        -0.5
      );
    } else {
      note(`RSI (${timeframeLabel}) อยู่ที่ ${input.rsi.toFixed(2)} อยู่ในโซนกลาง ยังไม่ชี้ทิศทางชัดเจน`);
    }
  }

  if (
    input.macd !== null &&
    input.macdSignal !== null &&
    input.macdHistPrev !== null &&
    input.macdHistLast !== null
  ) {
    const above = input.macd > input.macdSignal;
    const strengthening =
      Math.abs(input.macdHistLast) > Math.abs(input.macdHistPrev);
    if (above && strengthening) {
      note(`MACD (${timeframeLabel}) อยู่เหนือเส้นสัญญาณและช่องว่างกว้างขึ้น — แรงส่งขาขึ้นกำลังเพิ่มขึ้น`, 1);
    } else if (above) {
      note(`MACD (${timeframeLabel}) อยู่เหนือเส้นสัญญาณแต่ช่องว่างเริ่มแคบลง — แนวโน้มขาขึ้นเริ่มชะลอ`, 0.3);
    } else if (!above && strengthening) {
      note(`MACD (${timeframeLabel}) อยู่ใต้เส้นสัญญาณและช่องว่างกว้างขึ้น — แรงกดดันขาลงกำลังเพิ่มขึ้น`, -1);
    } else {
      note(`MACD (${timeframeLabel}) อยู่ใต้เส้นสัญญาณแต่ช่องว่างเริ่มแคบลง — แรงขายเริ่มอ่อนแรง อาจใกล้กลับตัว`, -0.3);
    }
  }

  if (input.tfEmaFast != null && input.tfEmaSlow != null) {
    if (input.price < input.tfEmaFast && input.tfEmaFast < input.tfEmaSlow) {
      note(`ราคาอยู่ใต้ EMA20 และ EMA50 ของกรอบ ${timeframeLabel} — แนวโน้มระยะสั้นเป็นขาลง`, -1);
    } else if (input.price > input.tfEmaFast && input.tfEmaFast > input.tfEmaSlow) {
      note(`ราคาอยู่เหนือ EMA20 และ EMA50 ของกรอบ ${timeframeLabel} — แนวโน้มระยะสั้นเป็นขาขึ้น`, 1);
    }
  }

  if (input.ma20 !== null && input.ma50 !== null && input.ma200 !== null) {
    if (input.price > input.ma20 && input.ma20 > input.ma50 && input.ma50 > input.ma200) {
      note("ราคาอยู่เหนือ MA20, MA50 และ MA200 (รายวัน) ตามลำดับ — โครงสร้างแนวโน้มขาขึ้นแข็งแรง", 1.5);
    } else if (
      input.price < input.ma20 &&
      input.ma20 < input.ma50 &&
      input.ma50 < input.ma200
    ) {
      note("ราคาอยู่ใต้ MA20, MA50 และ MA200 (รายวัน) ตามลำดับ — โครงสร้างแนวโน้มขาลงแข็งแรง", -1.5);
    } else if (input.ma50 > input.ma200) {
      note("MA50 (รายวัน) ยังอยู่เหนือ MA200 (แนวโน้มหลักยังเป็นขาขึ้น) แต่ราคาระยะสั้นเริ่มแกว่งตัว", 0.3);
    } else {
      note("MA50 (รายวัน) อยู่ใต้ MA200 (แนวโน้มหลักยังเป็นขาลง) ต้องรอสัญญาณกลับตัวที่ชัดเจนกว่านี้", -0.3);
    }
  }

  if (input.bollingerUpper !== null && input.bollingerLower !== null) {
    if (input.price >= input.bollingerUpper) {
      note("ราคาแตะกรอบบนของ Bollinger Band (รายวัน) — ความผันผวนสูงและราคายืดตัวเต็มกรอบ");
    } else if (input.price <= input.bollingerLower) {
      note("ราคาแตะกรอบล่างของ Bollinger Band (รายวัน) — อาจเกิดแรงซื้อกลับในกรอบความผันผวนนี้");
    }
  }

  // Context lines only, no score. scripts/backtest-technical.mjs found no edge in daily/weekly
  // alignment — aligned downtrends were followed by above-average returns, not below — so
  // the read reports the alignment without voting on it.
  if (input.weeklyTrend === "up" || input.weeklyTrend === "down") {
    const weeklyUp = input.weeklyTrend === "up";
    if (weeklyUp && uptrend) {
      note("แนวโน้มรายสัปดาห์เป็นขาขึ้น สอดคล้องกับรายวัน");
    } else if (!weeklyUp && downtrend) {
      note("แนวโน้มรายสัปดาห์เป็นขาลง สอดคล้องกับรายวัน");
    } else if (weeklyUp && downtrend) {
      note("รายวันเป็นขาลง แต่แนวโน้มรายสัปดาห์ยังเป็นขาขึ้น — สองกรอบเวลาชี้คนละทาง");
    } else if (!weeklyUp && uptrend) {
      note("รายวันเป็นขาขึ้น แต่แนวโน้มรายสัปดาห์ยังเป็นขาลง — สองกรอบเวลาชี้คนละทาง");
    }
  }

  if (input.atrPct != null && input.atrPct >= HIGH_VOLATILITY_ATR_PCT) {
    note(
      `ความผันผวนรายวัน (ATR 14 วัน) อยู่ราว ${input.atrPct.toFixed(2)}% ของราคา — สูง ราคาแกว่งแรงในแต่ละวัน ควรเผื่อระยะความเสี่ยงให้กว้างขึ้น`
    );
  }

  // Context line only, no score: in the backtest, heavy volume on an up day carried no edge
  // and heavy volume on a down day was followed by a rebound more often than not. Only the
  // high side is reported — the latest daily bar can still be forming during the session,
  // which understates volume, so "thin volume" would misfire.
  if (
    input.volumeRatio != null &&
    input.lastDayChangePct != null &&
    input.volumeRatio >= 1.5 &&
    Math.abs(input.lastDayChangePct) >= 0.5
  ) {
    note(
      `ปริมาณซื้อขายล่าสุดสูงกว่าค่าเฉลี่ย 20 วัน ${input.volumeRatio.toFixed(1)} เท่า ในวันที่ราคา${input.lastDayChangePct > 0 ? "ปรับขึ้น" : "ปรับลง"} ${pct(input.lastDayChangePct)}`
    );
  }

  return result();
}

export function buildFundamentalRead(input: FundamentalInputs): SideRead {
  const { note, result } = sideBuilder();

  if (input.revenueGrowthYoY !== null) {
    if (input.revenueGrowthYoY > 30) {
      note(`รายได้เติบโต ${pct(input.revenueGrowthYoY)} เทียบปีก่อน — อัตราเติบโตสูงมากตามมาตรฐานหุ้นขนาดใหญ่`, 1.5);
    } else if (input.revenueGrowthYoY > 10) {
      note(`รายได้เติบโต ${pct(input.revenueGrowthYoY)} เทียบปีก่อน — เติบโตต่อเนื่องในระดับที่มั่นคง`, 0.7);
    } else if (input.revenueGrowthYoY >= 0) {
      note(`รายได้เติบโต ${pct(input.revenueGrowthYoY)} เทียบปีก่อน — อัตราเติบโตเริ่มชะลอตัว`);
    } else {
      note(`รายได้หดตัว ${pct(input.revenueGrowthYoY)} เทียบปีก่อน — ควรติดตามสาเหตุการชะลอตัวอย่างใกล้ชิด`, -1.5);
    }
  }

  if (input.netMarginTTM !== null) {
    if (input.netMarginTTM > 30) {
      note(`อัตรากำไรสุทธิ ${input.netMarginTTM.toFixed(2)}% สูงมาก สะท้อนความสามารถในการทำกำไรที่แข็งแกร่ง`, 1);
    } else if (input.netMarginTTM > 15) {
      note(`อัตรากำไรสุทธิ ${input.netMarginTTM.toFixed(2)}% อยู่ในระดับดี`, 0.5);
    } else {
      note(`อัตรากำไรสุทธิ ${input.netMarginTTM.toFixed(2)}% ค่อนข้างบาง ควรติดตามแนวโน้มต้นทุน`, -0.3);
    }
  }

  if (input.peTTM !== null) {
    if (input.peTTM > 60) {
      note(`P/E ปัจจุบันอยู่ที่ ${input.peTTM.toFixed(2)} เท่า ตลาดตีมูลค่าล่วงหน้าไปมากสำหรับการเติบโตในอนาคต — ความเสี่ยงด้าน valuation สูง`, -1);
    } else if (input.peTTM > 35) {
      note(`P/E ปัจจุบันอยู่ที่ ${input.peTTM.toFixed(2)} เท่า ยังสะท้อนความคาดหวังการเติบโตสูงกว่าตลาดโดยรวม`, -0.3);
    } else {
      note(`P/E ปัจจุบันอยู่ที่ ${input.peTTM.toFixed(2)} เท่า อยู่ในระดับที่ตลาดยังไม่ได้ตีมูลค่าล่วงหน้าสูงจนน่ากังวล`, 0.5);
    }
  }

  if (input.epsGrowthYoY !== null) {
    if (input.epsGrowthYoY > 25) {
      note(`กำไรต่อหุ้น (EPS) เติบโต ${pct(input.epsGrowthYoY)} เทียบปีก่อน — กำไรโตแรง`, 0.7);
    } else if (input.epsGrowthYoY >= 0) {
      note(`กำไรต่อหุ้น (EPS) เติบโต ${pct(input.epsGrowthYoY)} เทียบปีก่อน`);
    } else {
      note(`กำไรต่อหุ้น (EPS) หดตัว ${pct(input.epsGrowthYoY)} เทียบปีก่อน — ฐานกำไรอ่อนลง`, -0.7);
    }
  }

  // A fixed P/E cutoff punishes fast growers and flatters stagnant ones; PEG puts the
  // multiple against the growth that is supposed to justify it. Only meaningful when both
  // are positive.
  if (input.peTTM !== null && input.peTTM > 0 && input.epsGrowthYoY !== null && input.epsGrowthYoY > 0) {
    const peg = input.peTTM / input.epsGrowthYoY;
    if (peg < 1) {
      note(`PEG ${peg.toFixed(2)} (P/E เทียบอัตราเติบโตของ EPS) ต่ำกว่า 1 — ราคายังสมเหตุสมผลเมื่อเทียบการเติบโต`, 0.5);
    } else if (peg > 2) {
      note(`PEG ${peg.toFixed(2)} (P/E เทียบอัตราเติบโตของ EPS) สูงกว่า 2 — มูลค่าสูงเมื่อเทียบกับการเติบโตที่เกิดขึ้นจริง`, -0.5);
    }
  }

  // Two relative yardsticks for the same multiple: the stock's own history, and its sector.
  // Their scores are deliberately small — the absolute P/E rule above already moves the score,
  // and these are context for it, not a second independent vote.
  if (
    input.peTTM !== null &&
    input.peTTM > 0 &&
    input.peHistoryPercentile != null &&
    input.peHistoryMedian != null
  ) {
    const p = input.peHistoryPercentile;
    const detail = `P/E ปัจจุบัน ${input.peTTM.toFixed(2)} เท่า สูงกว่าราว ${Math.round(p)}% ของช่วง 5 ปีย้อนหลัง (มัธยฐาน ${input.peHistoryMedian.toFixed(2)} เท่า)`;
    if (p >= 85) {
      note(`${detail} — แพงเมื่อเทียบกับประวัติของหุ้นเอง`, -0.5);
    } else if (p <= 15) {
      note(`${detail} — ถูกเมื่อเทียบกับประวัติของหุ้นเอง`, 0.5);
    } else {
      note(`${detail} — อยู่ในช่วงกลางของประวัติ`);
    }
  }

  if (
    input.peTTM !== null &&
    input.peTTM > 0 &&
    input.sectorPeMedian != null &&
    input.sectorPeMedian > 0
  ) {
    const ratio = input.peTTM / input.sectorPeMedian;
    const label = input.sectorLabel ? `กลุ่ม${input.sectorLabel}` : "กลุ่มเดียวกัน";
    const detail = `P/E ของหุ้นเป็น ${ratio.toFixed(2)} เท่าของมัธยฐาน${label} (${input.sectorPeMedian.toFixed(2)} เท่า)`;
    if (ratio >= 1.5) {
      note(`${detail} — มูลค่าสูงกว่ากลุ่มชัดเจน`, -0.3);
    } else if (ratio <= 0.7) {
      note(`${detail} — มูลค่าต่ำกว่ากลุ่มชัดเจน`, 0.3);
    } else {
      note(`${detail} — ใกล้เคียงกับกลุ่ม`);
    }
  }

  if (input.week52High !== null && input.week52Low !== null) {
    const range = input.week52High - input.week52Low;
    const position = range > 0 ? (input.price - input.week52Low) / range : 0.5;
    if (position > 0.9) {
      note(`ราคาปัจจุบันอยู่ใกล้จุดสูงสุดในรอบ 52 สัปดาห์ (${(position * 100).toFixed(2)}% ของกรอบ) — โมเมนตัมเชิงบวกแข็งแรงแต่ upside ระยะสั้นเริ่มจำกัด`);
    } else if (position < 0.15) {
      note(`ราคาปัจจุบันอยู่ใกล้จุดต่ำสุดในรอบ 52 สัปดาห์ (${(position * 100).toFixed(2)}% ของกรอบ) — อาจเป็นโซนสะสมหากปัจจัยพื้นฐานยังไม่เปลี่ยนแปลง`);
    }
  }

  return result();
}

const SIDE_DIR_TH = { 1: "ขาขึ้น", [-1]: "ขาลง" } as const;

/** The signal that moved `drivers` furthest in `sign`'s direction — what to cite for a side. */
function strongestDriver(drivers: Driver[], sign: 1 | -1): Driver | undefined {
  return drivers
    .filter((d) => Math.sign(d.delta) === sign)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
}

function agreementOf(
  verdict: AnalysisRead["verdict"],
  techScore: number,
  fundScore: number,
  total: number
): AnalysisRead["agreement"] {
  if (verdict === "mixed" || verdict === "neutral") return "low";
  const sameDirection = Math.sign(techScore) * Math.sign(fundScore) > 0;
  const strength = Math.abs(total);
  if (sameDirection) return strength >= 4 ? "high" : "medium";
  // One side flat or pulling the other way: the lean rests on a single side, so it takes a
  // much larger margin to call it consistent, and it never reaches "high".
  return strength >= 3 ? "medium" : "low";
}

export function synthesize(
  technical: TechnicalInputs,
  fundamental: FundamentalInputs,
  timeframeLabel?: string
): AnalysisRead {
  const tech = buildTechnicalRead(technical, timeframeLabel);
  const fund = buildFundamentalRead(fundamental);
  const total = tech.score + fund.score;

  // Opposite signs alone are not a disagreement: +0.3 against -0.2 is two faint readings,
  // not two camps, so each side has to lean past a floor to count. Past that floor any
  // disagreement is "mixed" — strong fundamentals must not turn a falling chart into a
  // bullish headline just because they outscore it.
  const opposed = Math.sign(tech.score) * Math.sign(fund.score) < 0;
  const conflicting =
    opposed && Math.abs(tech.score) >= CONFLICT_MIN && Math.abs(fund.score) >= CONFLICT_MIN;
  const mixed = conflicting;

  const conflicts: string[] = [];
  if (conflicting) {
    const techSign = Math.sign(tech.score) as 1 | -1;
    const fundSign = Math.sign(fund.score) as 1 | -1;
    const techDriver = strongestDriver(tech.drivers, techSign);
    const fundDriver = strongestDriver(fund.drivers, fundSign);
    conflicts.push(
      `ด้านเทคนิคเอนไปทาง${SIDE_DIR_TH[techSign]}${techDriver ? ` — ${techDriver.line}` : ""}`,
      `ด้านปัจจัยพื้นฐานเอนไปทาง${SIDE_DIR_TH[fundSign]}${fundDriver ? ` — ${fundDriver.line}` : ""}`
    );
  }

  let verdict: AnalysisRead["verdict"];
  let verdictText: string;

  if (mixed) {
    verdict = "mixed";
    verdictText =
      "สัญญาณเทคนิคและปัจจัยพื้นฐานให้น้ำหนักคนละทาง — เหมาะกับการติดตามอย่างใกล้ชิดมากกว่าการตัดสินใจจากด้านใดด้านหนึ่งเพียงอย่างเดียว";
  } else if (total >= 2 || total <= -2) {
    const bullish = total > 0;
    verdict = bullish ? "bullish" : "bearish";
    const sameDirection = Math.sign(tech.score) * Math.sign(fund.score) > 0;
    if (sameDirection) {
      verdictText = bullish
        ? "ทั้งภาพเทคนิคและปัจจัยพื้นฐานส่วนใหญ่เอนไปทางเชิงบวก"
        : "ทั้งภาพเทคนิคและปัจจัยพื้นฐานส่วนใหญ่เอนไปทางเชิงลบ";
    } else {
      // One side is flat or only faintly against — say which side carries the lean rather
      // than claiming both agree.
      const lead = Math.abs(tech.score) >= Math.abs(fund.score) ? "เทคนิค" : "ปัจจัยพื้นฐาน";
      verdictText = `ภาพรวมเอนไปทางเชิง${bullish ? "บวก" : "ลบ"} โดยมีน้ำหนักมาจากด้าน${lead}เป็นหลัก`;
    }
  } else {
    verdict = "neutral";
    verdictText = "สัญญาณโดยรวมยังไม่ชี้ทิศทางชัดเจน เหมาะกับการรอความชัดเจนเพิ่มเติม";
  }

  return {
    technical: tech.lines,
    fundamental: fund.lines,
    verdict,
    verdictText,
    agreement: agreementOf(verdict, tech.score, fund.score, total),
    conflicts,
  };
}

const PE_HISTORY_QUARTERS = 20;
const PE_HISTORY_MIN_POINTS = 12;
const SECTOR_MIN_PEERS = 3;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Positive quarter-end P/Es from Finnhub's quarterly series, newest first, capped to five
 *  years. Loss-making quarters (no meaningful P/E) are dropped rather than counted as zero. */
function quarterlyPeHistory(financials: FinnhubBasicFinancials): number[] {
  const series = financials.series as
    | { quarterly?: { peTTM?: { period: string; v: number }[] } }
    | undefined;
  const points = series?.quarterly?.peTTM;
  if (!Array.isArray(points)) return [];
  return points
    .filter((p) => typeof p?.v === "number" && p.v > 0)
    .sort((a, b) => b.period.localeCompare(a.period))
    .slice(0, PE_HISTORY_QUARTERS)
    .map((p) => p.v);
}

/**
 * Valuation context that needs more than the stock's own current ratios: where today's P/E
 * sits in its five-year range, and how it compares with its sector peers. Sector comparison
 * only exists for symbols in the heatmap universe (that's where sector membership is
 * defined); everything degrades to null rather than throwing, since it is garnish on a read
 * that is complete without it. Peer fetches ride getBasicFinancials' one-hour cache.
 */
export async function deriveValuationContext(
  symbol: string,
  financials: FinnhubBasicFinancials,
  currentPe: number | null
): Promise<
  Pick<FundamentalInputs, "peHistoryPercentile" | "peHistoryMedian" | "sectorPeMedian" | "sectorLabel">
> {
  let peHistoryPercentile: number | null = null;
  let peHistoryMedian: number | null = null;
  const history = quarterlyPeHistory(financials);
  if (currentPe !== null && currentPe > 0 && history.length >= PE_HISTORY_MIN_POINTS) {
    peHistoryPercentile = (history.filter((v) => v <= currentPe).length / history.length) * 100;
    peHistoryMedian = median(history);
  }

  let sectorPeMedian: number | null = null;
  let label: string | null = null;
  const entry = HEATMAP_UNIVERSE.find((u) => u.symbol === symbol.toUpperCase());
  if (entry) {
    const peers = HEATMAP_UNIVERSE.filter((u) => u.sector === entry.sector && u.symbol !== entry.symbol);
    const pes = await mapWithConcurrency(peers, 3, async (peer) => {
      try {
        const m = (await getBasicFinancials(peer.symbol)).metric;
        const pe = m.peNormalizedAnnual ?? m.peTTM;
        return typeof pe === "number" && pe > 0 ? pe : null;
      } catch {
        return null;
      }
    });
    const valid = pes.filter((v): v is number => v !== null);
    if (valid.length >= SECTOR_MIN_PEERS) {
      sectorPeMedian = median(valid);
      label = sectorLabel(entry.sector);
    }
  }

  return { peHistoryPercentile, peHistoryMedian, sectorPeMedian, sectorLabel: label };
}

/**
 * The volume, volatility and weekly-trend inputs, all derived from one daily candle series
 * so that getAnalysisRead and the daily summary feed synthesize() identical numbers.
 * Every field degrades to null when the series is too short to support it.
 */
export function deriveDailyContext(
  daily: FinnhubCandles,
  price: number
): Pick<TechnicalInputs, "volumeRatio" | "lastDayChangePct" | "atrPct" | "weeklyTrend"> {
  const closes = daily.c;

  // Latest volume against the 20 bars before it (the latest bar is excluded from its own
  // baseline). Null when the baseline is short or the latest bar has no volume yet.
  const priorVolumes = daily.v.slice(-21, -1);
  const avgVolume = priorVolumes.length === 20 ? priorVolumes.reduce((a, b) => a + b, 0) / 20 : 0;
  const lastVolume = daily.v[daily.v.length - 1];
  const prevClose = closes[closes.length - 2];
  const lastClose = closes[closes.length - 1];

  const lastAtr = lastValid(atr(daily.h, daily.l, closes, 14));

  // 10w/30w is the weekly counterpart of the 50d/200d stack used for the daily trend.
  const weekly = weeklyCloses(daily.t, closes);
  const w10 = lastValid(sma(weekly, 10));
  const w30 = lastValid(sma(weekly, 30));
  let weeklyTrend: TechnicalInputs["weeklyTrend"] = null;
  if (w10 !== null && w30 !== null) {
    if (price > w10 && w10 > w30) weeklyTrend = "up";
    else if (price < w10 && w10 < w30) weeklyTrend = "down";
    else weeklyTrend = "mixed";
  }

  return {
    volumeRatio: avgVolume > 0 && lastVolume > 0 ? lastVolume / avgVolume : null,
    lastDayChangePct: prevClose > 0 ? ((lastClose - prevClose) / prevClose) * 100 : null,
    atrPct: lastAtr !== null && price > 0 ? (lastAtr / price) * 100 : null,
    weeklyTrend,
  };
}

/**
 * Fetches live data and runs the rule-based synthesis end to end — the same computation
 * src/app/api/analysis/route.ts serves to the analysis panel, extracted here so any other
 * caller (e.g. the chat context builder) gets real computed RSI/MACD/MA readings instead
 * of duplicating this fetch-and-compute wiring.
 *
 * MA20/MA50/MA200 and Bollinger Bands are always computed from daily candles regardless of
 * `timeframe` — their labels (e.g. "MA200") conventionally mean a 200-*day* average, and
 * computing them off intraday bars would silently redefine what the number means. RSI and
 * MACD don't carry that same fixed-period convention, so they follow whatever `timeframe`
 * the caller is currently looking at (matches the price chart's own selected tab).
 */
export async function getAnalysisRead(
  timeframe: TimeframeKey = "1H",
  symbol: string = SYMBOL
): Promise<AnalysisRead> {
  const tf = TIMEFRAMES.find((t) => t.key === timeframe) ?? TIMEFRAMES.find((t) => t.key === "1H")!;

  const [dailyCandles, tfCandles, quote, financials] = await Promise.all([
    getYahooCandles(symbol, "2y", "1d"),
    getYahooCandles(symbol, tf.yahooRange, tf.yahooInterval),
    getQuote(symbol),
    getBasicFinancials(symbol),
  ]);

  if (dailyCandles.s !== "ok" || dailyCandles.c.length < 30 || tfCandles.s !== "ok" || tfCandles.c.length < 30) {
    throw new AnalysisDataError("NO_DATA");
  }

  const price = quote.c;

  const rsiSeries = rsi(tfCandles.c, 14);
  const macdSeries = macd(tfCandles.c);
  const intraday = tf.yahooInterval.endsWith("m");

  const dailyCloses = dailyCandles.c;
  const ma20 = sma(dailyCloses, 20);
  const ma50 = sma(dailyCloses, 50);
  const ma200 = sma(dailyCloses, 200);
  const bb = bollinger(dailyCloses, 20);
  const m = financials.metric;
  const pe = m.peNormalizedAnnual ?? m.peTTM ?? null;
  const valuation = await deriveValuationContext(symbol, financials, pe);

  return synthesize(
    {
      price,
      rsi: lastValid(rsiSeries),
      macd: lastValid(macdSeries.macd),
      macdSignal: lastValid(macdSeries.signal),
      macdHistPrev: macdSeries.histogram[macdSeries.histogram.length - 2] ?? null,
      macdHistLast: macdSeries.histogram[macdSeries.histogram.length - 1] ?? null,
      ma20: lastValid(ma20),
      ma50: lastValid(ma50),
      ma200: lastValid(ma200),
      bollingerUpper: lastValid(bb.upper),
      bollingerLower: lastValid(bb.lower),
      tfEmaFast: intraday ? lastValid(ema(tfCandles.c, 20)) : null,
      tfEmaSlow: intraday ? lastValid(ema(tfCandles.c, 50)) : null,
      ...deriveDailyContext(dailyCandles, price),
    },
    {
      peTTM: pe,
      psTTM: m.psTTM ?? null,
      netMarginTTM: m.netProfitMarginTTM ?? null,
      grossMarginTTM: m.grossMarginTTM ?? null,
      revenueGrowthYoY: m.revenueGrowthTTMYoy ?? m.revenueGrowthQuarterlyYoy ?? null,
      epsGrowthYoY: m.epsGrowthTTMYoy ?? m.epsGrowthQuarterlyYoy ?? null,
      week52High: m["52WeekHigh"] ?? null,
      week52Low: m["52WeekLow"] ?? null,
      price,
      ...valuation,
    },
    timeframe
  );
}
