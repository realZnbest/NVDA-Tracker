import { getBasicFinancials, getQuote } from "./finnhub";
import { getYahooCandles } from "./yahoo";
import { SYMBOL, TIMEFRAMES, type TimeframeKey } from "./timeframes";
import { bollinger, ema, lastValid, macd, rsi, sma } from "./indicators";

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
}

export interface AnalysisRead {
  technical: string[];
  fundamental: string[];
  verdict: "bullish" | "bearish" | "neutral" | "mixed";
  verdictText: string;
}

function pct(n: number) {
  return `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
}

export function buildTechnicalRead(
  input: TechnicalInputs,
  timeframeLabel: string = "รายวัน"
): {
  lines: string[];
  score: number;
} {
  const lines: string[] = [];
  let score = 0;

  if (input.rsi !== null) {
    if (input.rsi >= 70) {
      lines.push(
        `RSI (${timeframeLabel}) อยู่ที่ ${input.rsi.toFixed(1)} เข้าเขตซื้อมากเกิน (Overbought) — โมเมนตัมแข็งแกร่งแต่เสี่ยงพักตัวระยะสั้น`
      );
      score -= 1;
    } else if (input.rsi <= 30) {
      lines.push(
        `RSI (${timeframeLabel}) อยู่ที่ ${input.rsi.toFixed(1)} เข้าเขตขายมากเกิน (Oversold) — แรงขายอาจเริ่มอ่อนแรงลง`
      );
      score += 1;
    } else if (input.rsi >= 55) {
      lines.push(
        `RSI (${timeframeLabel}) อยู่ที่ ${input.rsi.toFixed(1)} เอนไปทางฝั่งซื้อ สะท้อนแนวโน้มขาขึ้นที่ยังไม่ตึงตัวเกินไป`
      );
      score += 0.5;
    } else if (input.rsi <= 45) {
      lines.push(
        `RSI (${timeframeLabel}) อยู่ที่ ${input.rsi.toFixed(1)} เอนไปทางฝั่งขาย สะท้อนแรงกดดันขาลงที่ยังไม่ถึงจุดสุดขั้ว`
      );
      score -= 0.5;
    } else {
      lines.push(`RSI (${timeframeLabel}) อยู่ที่ ${input.rsi.toFixed(1)} อยู่ในโซนกลาง ยังไม่ชี้ทิศทางชัดเจน`);
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
      lines.push(`MACD (${timeframeLabel}) อยู่เหนือเส้นสัญญาณและช่องว่างกว้างขึ้น — แรงส่งขาขึ้นกำลังเพิ่มขึ้น`);
      score += 1;
    } else if (above) {
      lines.push(`MACD (${timeframeLabel}) อยู่เหนือเส้นสัญญาณแต่ช่องว่างเริ่มแคบลง — แนวโน้มขาขึ้นเริ่มชะลอ`);
      score += 0.3;
    } else if (!above && strengthening) {
      lines.push(`MACD (${timeframeLabel}) อยู่ใต้เส้นสัญญาณและช่องว่างกว้างขึ้น — แรงกดดันขาลงกำลังเพิ่มขึ้น`);
      score -= 1;
    } else {
      lines.push(`MACD (${timeframeLabel}) อยู่ใต้เส้นสัญญาณแต่ช่องว่างเริ่มแคบลง — แรงขายเริ่มอ่อนแรง อาจใกล้กลับตัว`);
      score -= 0.3;
    }
  }

  if (input.ma20 !== null && input.ma50 !== null && input.ma200 !== null) {
    if (input.price > input.ma20 && input.ma20 > input.ma50 && input.ma50 > input.ma200) {
      lines.push("ราคาอยู่เหนือ MA20, MA50 และ MA200 (รายวัน) ตามลำดับ — โครงสร้างแนวโน้มขาขึ้นแข็งแรง");
      score += 1.5;
    } else if (
      input.price < input.ma20 &&
      input.ma20 < input.ma50 &&
      input.ma50 < input.ma200
    ) {
      lines.push("ราคาอยู่ใต้ MA20, MA50 และ MA200 (รายวัน) ตามลำดับ — โครงสร้างแนวโน้มขาลงแข็งแรง");
      score -= 1.5;
    } else if (input.ma50 > input.ma200) {
      lines.push("MA50 (รายวัน) ยังอยู่เหนือ MA200 (แนวโน้มหลักยังเป็นขาขึ้น) แต่ราคาระยะสั้นเริ่มแกว่งตัว");
      score += 0.3;
    } else {
      lines.push("MA50 (รายวัน) อยู่ใต้ MA200 (แนวโน้มหลักยังเป็นขาลง) ต้องรอสัญญาณกลับตัวที่ชัดเจนกว่านี้");
      score -= 0.3;
    }
  }

  if (input.bollingerUpper !== null && input.bollingerLower !== null) {
    if (input.price >= input.bollingerUpper) {
      lines.push("ราคาแตะกรอบบนของ Bollinger Band (รายวัน) — ความผันผวนสูงและราคายืดตัวเต็มกรอบ");
    } else if (input.price <= input.bollingerLower) {
      lines.push("ราคาแตะกรอบล่างของ Bollinger Band (รายวัน) — อาจเกิดแรงซื้อกลับในกรอบความผันผวนนี้");
    }
  }

  return { lines, score };
}

export function buildFundamentalRead(input: FundamentalInputs): {
  lines: string[];
  score: number;
} {
  const lines: string[] = [];
  let score = 0;

  if (input.revenueGrowthYoY !== null) {
    if (input.revenueGrowthYoY > 30) {
      lines.push(`รายได้เติบโต ${pct(input.revenueGrowthYoY)} เทียบปีก่อน — อัตราเติบโตสูงมากตามมาตรฐานหุ้นขนาดใหญ่`);
      score += 1.5;
    } else if (input.revenueGrowthYoY > 10) {
      lines.push(`รายได้เติบโต ${pct(input.revenueGrowthYoY)} เทียบปีก่อน — เติบโตต่อเนื่องในระดับที่มั่นคง`);
      score += 0.7;
    } else if (input.revenueGrowthYoY >= 0) {
      lines.push(`รายได้เติบโต ${pct(input.revenueGrowthYoY)} เทียบปีก่อน — อัตราเติบโตเริ่มชะลอตัว`);
    } else {
      lines.push(`รายได้หดตัว ${pct(input.revenueGrowthYoY)} เทียบปีก่อน — ควรติดตามสาเหตุการชะลอตัวอย่างใกล้ชิด`);
      score -= 1.5;
    }
  }

  if (input.netMarginTTM !== null) {
    if (input.netMarginTTM > 30) {
      lines.push(`อัตรากำไรสุทธิ ${input.netMarginTTM.toFixed(1)}% สูงมาก สะท้อนความสามารถในการทำกำไรที่แข็งแกร่ง`);
      score += 1;
    } else if (input.netMarginTTM > 15) {
      lines.push(`อัตรากำไรสุทธิ ${input.netMarginTTM.toFixed(1)}% อยู่ในระดับดี`);
      score += 0.5;
    } else {
      lines.push(`อัตรากำไรสุทธิ ${input.netMarginTTM.toFixed(1)}% ค่อนข้างบาง ควรติดตามแนวโน้มต้นทุน`);
      score -= 0.3;
    }
  }

  if (input.peTTM !== null) {
    if (input.peTTM > 60) {
      lines.push(`P/E ปัจจุบันอยู่ที่ ${input.peTTM.toFixed(1)} เท่า ตลาดตีมูลค่าล่วงหน้าไปมากสำหรับการเติบโตในอนาคต — ความเสี่ยงด้าน valuation สูง`);
      score -= 1;
    } else if (input.peTTM > 35) {
      lines.push(`P/E ปัจจุบันอยู่ที่ ${input.peTTM.toFixed(1)} เท่า ยังสะท้อนความคาดหวังการเติบโตสูงกว่าตลาดโดยรวม`);
      score -= 0.3;
    } else {
      lines.push(`P/E ปัจจุบันอยู่ที่ ${input.peTTM.toFixed(1)} เท่า อยู่ในระดับที่ตลาดยังไม่ได้ตีมูลค่าล่วงหน้าสูงจนน่ากังวล`);
      score += 0.5;
    }
  }

  if (input.week52High !== null && input.week52Low !== null) {
    const range = input.week52High - input.week52Low;
    const position = range > 0 ? (input.price - input.week52Low) / range : 0.5;
    if (position > 0.9) {
      lines.push(`ราคาปัจจุบันอยู่ใกล้จุดสูงสุดในรอบ 52 สัปดาห์ (${(position * 100).toFixed(0)}% ของกรอบ) — โมเมนตัมเชิงบวกแข็งแรงแต่ upside ระยะสั้นเริ่มจำกัด`);
    } else if (position < 0.15) {
      lines.push(`ราคาปัจจุบันอยู่ใกล้จุดต่ำสุดในรอบ 52 สัปดาห์ (${(position * 100).toFixed(0)}% ของกรอบ) — อาจเป็นโซนสะสมหากปัจจัยพื้นฐานยังไม่เปลี่ยนแปลง`);
    }
  }

  return { lines, score };
}

export function synthesize(
  technical: TechnicalInputs,
  fundamental: FundamentalInputs,
  timeframeLabel?: string
): AnalysisRead {
  const tech = buildTechnicalRead(technical, timeframeLabel);
  const fund = buildFundamentalRead(fundamental);
  const total = tech.score + fund.score;

  let verdict: AnalysisRead["verdict"];
  let verdictText: string;

  if (Math.sign(tech.score) !== 0 && Math.sign(fund.score) !== 0 && Math.sign(tech.score) !== Math.sign(fund.score)) {
    verdict = "mixed";
    verdictText =
      "สัญญาณเทคนิคและปัจจัยพื้นฐานให้น้ำหนักคนละทาง — เหมาะกับการติดตามอย่างใกล้ชิดมากกว่าการตัดสินใจจากด้านใดด้านหนึ่งเพียงอย่างเดียว";
  } else if (total >= 2) {
    verdict = "bullish";
    verdictText = "ทั้งภาพเทคนิคและปัจจัยพื้นฐานส่วนใหญ่เอนไปทางเชิงบวก";
  } else if (total <= -2) {
    verdict = "bearish";
    verdictText = "ทั้งภาพเทคนิคและปัจจัยพื้นฐานส่วนใหญ่เอนไปทางเชิงลบ";
  } else {
    verdict = "neutral";
    verdictText = "สัญญาณโดยรวมยังไม่ชี้ทิศทางชัดเจน เหมาะกับการรอความชัดเจนเพิ่มเติม";
  }

  return { technical: tech.lines, fundamental: fund.lines, verdict, verdictText };
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
export async function getAnalysisRead(timeframe: TimeframeKey = "1H"): Promise<AnalysisRead> {
  const tf = TIMEFRAMES.find((t) => t.key === timeframe) ?? TIMEFRAMES.find((t) => t.key === "1H")!;

  const [dailyCandles, tfCandles, quote, financials] = await Promise.all([
    getYahooCandles(SYMBOL, "2y", "1d"),
    getYahooCandles(SYMBOL, tf.yahooRange, tf.yahooInterval),
    getQuote(SYMBOL),
    getBasicFinancials(SYMBOL),
  ]);

  if (dailyCandles.s !== "ok" || dailyCandles.c.length < 30 || tfCandles.s !== "ok" || tfCandles.c.length < 30) {
    throw new AnalysisDataError("NO_DATA");
  }

  const price = quote.c;

  const rsiSeries = rsi(tfCandles.c, 14);
  const macdSeries = macd(tfCandles.c);

  const dailyCloses = dailyCandles.c;
  const ma20 = sma(dailyCloses, 20);
  const ma50 = ema(dailyCloses, 50);
  const ma200 = ema(dailyCloses, 200);
  const bb = bollinger(dailyCloses, 20);
  const m = financials.metric;

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
    },
    {
      peTTM: m.peNormalizedAnnual ?? m.peTTM ?? null,
      psTTM: m.psTTM ?? null,
      netMarginTTM: m.netProfitMarginTTM ?? null,
      grossMarginTTM: m.grossMarginTTM ?? null,
      revenueGrowthYoY: m.revenueGrowthTTMYoy ?? m.revenueGrowthQuarterlyYoy ?? null,
      epsGrowthYoY: m.epsGrowthTTMYoy ?? m.epsGrowthQuarterlyYoy ?? null,
      week52High: m["52WeekHigh"] ?? null,
      week52Low: m["52WeekLow"] ?? null,
      price,
    },
    timeframe
  );
}
