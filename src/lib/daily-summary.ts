import {
  getBasicFinancials,
  getCompanyNews,
  getEarningsCalendar,
  getQuote,
  getRecommendationTrends,
  getReportedFinancials,
  type FinnhubEarningsEvent,
  type FinnhubQuote,
} from "./finnhub";
import { getYahooCandles } from "./yahoo";
import { extractAllQuarters, type QuarterMetrics } from "./financial-metrics";
import { filterRelevantNews } from "./news-filter";
import {
  bollinger,
  computeSupportResistance,
  detectStructureBreaks,
  ema,
  findPivots,
  lastValid,
  macd,
  rsi,
  sma,
  type SRLevel,
  type StructureEvent,
} from "./indicators";
import { synthesize, type AnalysisRead } from "./analysis";
import {
  computeAggregatePositionsBySymbol,
  computePositionMetrics,
  defaultTargets,
  type AggregatePosition,
} from "./position";
import { listLots } from "./position-store";
import { SYMBOL } from "./timeframes";
import { generateChatReply, TONE_INSTRUCTION } from "./ai-provider";

/** Same swing sensitivity the price chart defaults to, so S/R and BOS/CHoCH match what you see. */
const SWING_BARS = 5;
const VOLUME_AVG_BARS = 20;

export interface PositionBlock {
  avgCost: number;
  totalShares: number;
  value: number;
  costBasis: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  daysHeld: number | null;
  /** % the price must move from here to reach average cost — negative once in profit. */
  breakEvenDistancePercent: number;
  targets: { price: number; pnl: number; pnlPercent: number }[];
}

export interface AnalystConsensus {
  period: string;
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
  total: number;
  label: string;
}

export interface SymbolSummary {
  symbol: string;
  quote: FinnhubQuote;
  volume: number | null;
  avgVolume: number | null;
  technical: {
    rsi: number | null;
    macd: number | null;
    macdSignal: number | null;
    macdHistogram: number | null;
    ma20: number | null;
    ma50: number | null;
    ma200: number | null;
    bollingerUpper: number | null;
    bollingerLower: number | null;
  };
  levels: SRLevel[];
  structure: StructureEvent[];
  fundamentals: {
    peTTM: number | null;
    psTTM: number | null;
    netMarginTTM: number | null;
    grossMarginTTM: number | null;
    revenueGrowthYoY: number | null;
    week52High: number | null;
    week52Low: number | null;
  };
  latestQuarter: QuarterMetrics | null;
  analyst: AnalystConsensus | null;
  earnings: { event: FinnhubEarningsEvent; daysAway: number } | null;
  headlines: { source: string; headline: string }[];
  position: PositionBlock | null;
  read: AnalysisRead | null;
}

export interface DailySummaryData {
  symbols: SymbolSummary[];
  portfolio: {
    totalValue: number;
    totalCost: number;
    unrealizedPnl: number;
    unrealizedPnlPercent: number;
  } | null;
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function fmtUsd(v: number | null | undefined): string {
  if (v === null || v === undefined) return "ไม่มีข้อมูล";
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  return `$${v.toFixed(2)}`;
}

function fmtNum(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined) return "ไม่มีข้อมูล";
  return v.toFixed(digits);
}

function fmtSigned(v: number, digits = 2): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)}`;
}

function fmtShares(v: number): string {
  return v.toLocaleString("th-TH", { maximumFractionDigits: 4 });
}

/** Yahoo reports share counts in the hundreds of millions — B/M is the only readable form. */
function fmtVolume(v: number | null): string {
  if (v === null) return "ไม่มีข้อมูล";
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(2)}K`;
  return String(Math.round(v));
}

function consensusLabel(t: {
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
}): string {
  const bullish = t.strongBuy + t.buy;
  const bearish = t.sell + t.strongSell;
  const total = bullish + bearish + t.hold;
  if (total === 0) return "ไม่มีข้อมูล";
  if (bullish / total >= 0.7) return "เอนไปทางซื้ออย่างชัดเจน";
  if (bullish > bearish + t.hold) return "ส่วนใหญ่แนะนำซื้อ";
  if (bearish > bullish) return "ส่วนใหญ่แนะนำขาย";
  return "ค่อนข้างเป็นกลาง";
}

/**
 * Every source is fetched independently and allowed to fail on its own — a rate-limited
 * news call must not cost the email its price and indicator sections. Same degrade-in-place
 * approach as buildChatContext in api/chat/route.ts.
 */
async function collectSymbol(
  symbol: string,
  position: AggregatePosition | null
): Promise<SymbolSummary | null> {
  const [candles, quote] = await Promise.all([
    getYahooCandles(symbol, "2y", "1d").catch(() => null),
    getQuote(symbol).catch(() => null),
  ]);
  // Price and daily candles are the two things every other section is derived from; with
  // either missing there's no summary worth writing for this symbol.
  if (!quote || !candles || candles.s !== "ok" || candles.c.length < 30) return null;

  const price = quote.c;
  const closes = candles.c;

  const rsiSeries = rsi(closes, 14);
  const macdSeries = macd(closes);
  const bb = bollinger(closes, 20);
  const technical = {
    rsi: lastValid(rsiSeries),
    macd: lastValid(macdSeries.macd),
    macdSignal: lastValid(macdSeries.signal),
    macdHistogram: lastValid(macdSeries.histogram),
    ma20: lastValid(sma(closes, 20)),
    ma50: lastValid(ema(closes, 50)),
    ma200: lastValid(ema(closes, 200)),
    bollingerUpper: lastValid(bb.upper),
    bollingerLower: lastValid(bb.lower),
  };

  const pivots = findPivots(candles.t, candles.h, candles.l, SWING_BARS, SWING_BARS);
  const levels = computeSupportResistance(pivots, price);
  const structure = detectStructureBreaks(
    candles.t,
    candles.h,
    candles.l,
    closes,
    SWING_BARS,
    SWING_BARS
  ).slice(-2);

  const volume = candles.v[candles.v.length - 1] ?? null;
  // Averaged over the bars *before* the latest one, so today's volume is compared against
  // a baseline it isn't itself part of.
  const priorVolumes = candles.v.slice(-(VOLUME_AVG_BARS + 1), -1);
  const avgVolume =
    priorVolumes.length > 0
      ? priorVolumes.reduce((a, b) => a + b, 0) / priorVolumes.length
      : null;

  const to = new Date();
  const [basic, reported, trends, earningsCal, news] = await Promise.all([
    getBasicFinancials(symbol).catch(() => null),
    getReportedFinancials(symbol, "quarterly").catch(() => null),
    getRecommendationTrends(symbol).catch(() => null),
    getEarningsCalendar(
      symbol,
      isoDate(to),
      isoDate(new Date(to.getTime() + 180 * 24 * 60 * 60_000))
    ).catch(() => null),
    getCompanyNews(
      symbol,
      isoDate(new Date(to.getTime() - 14 * 24 * 60 * 60 * 1000)),
      isoDate(to)
    ).catch(() => null),
  ]);

  const m = basic?.metric ?? {};
  const fundamentals = {
    peTTM: m.peNormalizedAnnual ?? m.peTTM ?? null,
    psTTM: m.psTTM ?? null,
    netMarginTTM: m.netProfitMarginTTM ?? null,
    grossMarginTTM: m.grossMarginTTM ?? null,
    revenueGrowthYoY: m.revenueGrowthTTMYoy ?? m.revenueGrowthQuarterlyYoy ?? null,
    week52High: m["52WeekHigh"] ?? null,
    week52Low: m["52WeekLow"] ?? null,
  };

  let latestQuarter: QuarterMetrics | null = null;
  if (reported) {
    try {
      latestQuarter = extractAllQuarters(reported).slice(-1)[0] ?? null;
    } catch {
      latestQuarter = null;
    }
  }

  let analyst: AnalystConsensus | null = null;
  if (trends && trends.length > 0) {
    const latest = trends.slice().sort((a, b) => b.period.localeCompare(a.period))[0];
    analyst = {
      period: latest.period,
      strongBuy: latest.strongBuy,
      buy: latest.buy,
      hold: latest.hold,
      sell: latest.sell,
      strongSell: latest.strongSell,
      total:
        latest.strongBuy + latest.buy + latest.hold + latest.sell + latest.strongSell,
      label: consensusLabel(latest),
    };
  }

  let earnings: SymbolSummary["earnings"] = null;
  const todayStr = isoDate(to);
  const upcoming = earningsCal?.earningsCalendar
    ?.filter((e) => e.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  if (upcoming) {
    const daysAway = Math.max(
      0,
      Math.ceil(
        (new Date(`${upcoming.date}T00:00:00Z`).getTime() -
          new Date(`${todayStr}T00:00:00Z`).getTime()) /
          (24 * 60 * 60 * 1000)
      )
    );
    earnings = { event: upcoming, daysAway };
  }

  const headlines = news
    ? filterRelevantNews(news)
        .sort((a, b) => b.datetime - a.datetime)
        .slice(0, 5)
        .map((n) => ({ source: n.source, headline: n.headline }))
    : [];

  let positionBlock: PositionBlock | null = null;
  if (position) {
    const metrics = computePositionMetrics(position, price);
    positionBlock = {
      avgCost: position.avgCost,
      totalShares: position.totalShares,
      value: metrics.value,
      costBasis: metrics.costBasis,
      unrealizedPnl: metrics.unrealizedPnl,
      unrealizedPnlPercent: metrics.unrealizedPnlPercent,
      daysHeld: metrics.daysHeld,
      breakEvenDistancePercent:
        price === 0 ? 0 : ((position.avgCost - price) / price) * 100,
      targets: defaultTargets(price).map((target) => {
        const pnl = (target - position.avgCost) * position.totalShares;
        return {
          price: target,
          pnl,
          pnlPercent:
            metrics.costBasis === 0 ? 0 : (pnl / metrics.costBasis) * 100,
        };
      }),
    };
  }

  let read: AnalysisRead | null = null;
  try {
    // synthesize() rather than getAnalysisRead(): the candles, quote and financials are
    // already in hand here, and getAnalysisRead would re-fetch all of them.
    read = synthesize(
      {
        price,
        rsi: technical.rsi,
        macd: technical.macd,
        macdSignal: technical.macdSignal,
        macdHistPrev: macdSeries.histogram[macdSeries.histogram.length - 2] ?? null,
        macdHistLast: macdSeries.histogram[macdSeries.histogram.length - 1] ?? null,
        ma20: technical.ma20,
        ma50: technical.ma50,
        ma200: technical.ma200,
        bollingerUpper: technical.bollingerUpper,
        bollingerLower: technical.bollingerLower,
      },
      {
        peTTM: fundamentals.peTTM,
        psTTM: fundamentals.psTTM,
        netMarginTTM: fundamentals.netMarginTTM,
        grossMarginTTM: fundamentals.grossMarginTTM,
        revenueGrowthYoY: fundamentals.revenueGrowthYoY,
        epsGrowthYoY: m.epsGrowthTTMYoy ?? m.epsGrowthQuarterlyYoy ?? null,
        week52High: fundamentals.week52High,
        week52Low: fundamentals.week52Low,
        price,
      },
      "รายวัน"
    );
  } catch {
    read = null;
  }

  return {
    symbol,
    quote,
    volume,
    avgVolume,
    technical,
    levels,
    structure,
    fundamentals,
    latestQuarter,
    analyst,
    earnings,
    headlines,
    position: positionBlock,
    read,
  };
}

/**
 * NVDA is always included (it's what the tracker is about); every symbol you hold is
 * added on top — the same symbol union /api/alerts/check evaluates against.
 */
export async function collectDailySummary(): Promise<DailySummaryData> {
  const lots = await listLots().catch(() => []);
  const positionsBySymbol = computeAggregatePositionsBySymbol(lots);
  const symbols = Array.from(new Set([SYMBOL, ...positionsBySymbol.keys()]));

  const collected = await Promise.all(
    symbols.map((symbol) =>
      collectSymbol(symbol, positionsBySymbol.get(symbol) ?? null).catch(() => null)
    )
  );
  const valid = collected.filter((s): s is SymbolSummary => s !== null);

  let portfolio: DailySummaryData["portfolio"] = null;
  const held = valid.filter((s) => s.position !== null);
  if (held.length > 0) {
    const totalValue = held.reduce((sum, s) => sum + s.position!.value, 0);
    const totalCost = held.reduce((sum, s) => sum + s.position!.costBasis, 0);
    portfolio = {
      totalValue,
      totalCost,
      unrealizedPnl: totalValue - totalCost,
      unrealizedPnlPercent:
        totalCost === 0 ? 0 : ((totalValue - totalCost) / totalCost) * 100,
    };
  }

  return { symbols: valid, portfolio };
}

function renderSymbolSection(s: SymbolSummary): string {
  const q = s.quote;
  const lines: string[] = [];

  lines.push(`▌ ${s.symbol}`);
  lines.push(
    `ราคาปิด $${fmtNum(q.c)} (${fmtSigned(q.d)}, ${fmtSigned(q.dp)}%) — เปิด $${fmtNum(q.o)} / สูงสุด $${fmtNum(q.h)} / ต่ำสุด $${fmtNum(q.l)} / ปิดก่อนหน้า $${fmtNum(q.pc)}`
  );

  if (s.volume !== null) {
    const ratio =
      s.avgVolume && s.avgVolume > 0 ? ` (${(s.volume / s.avgVolume).toFixed(2)}x ของค่าเฉลี่ย ${VOLUME_AVG_BARS} วัน)` : "";
    lines.push(`ปริมาณซื้อขาย ${fmtVolume(s.volume)} หุ้น${ratio}`);
  }

  const t = s.technical;
  lines.push(
    `เทคนิค: RSI(14) ${fmtNum(t.rsi)} | MACD ${fmtNum(t.macd, 3)} เทียบสัญญาณ ${fmtNum(t.macdSignal, 3)} (ฮิสโตแกรม ${fmtNum(t.macdHistogram, 3)})`
  );
  lines.push(
    `เส้นค่าเฉลี่ย: MA20 $${fmtNum(t.ma20)} | MA50 $${fmtNum(t.ma50)} | MA200 $${fmtNum(t.ma200)}`
  );
  lines.push(
    `Bollinger (20): กรอบบน $${fmtNum(t.bollingerUpper)} / กรอบล่าง $${fmtNum(t.bollingerLower)}`
  );

  const resistance = s.levels.filter((l) => l.type === "resistance");
  const support = s.levels.filter((l) => l.type === "support");
  if (resistance.length > 0) {
    lines.push(
      `แนวต้าน: ${resistance.map((l) => `$${fmtNum(l.price)} (${l.touches} จุด)`).join(", ")}`
    );
  }
  if (support.length > 0) {
    lines.push(
      `แนวรับ: ${support.map((l) => `$${fmtNum(l.price)} (${l.touches} จุด)`).join(", ")}`
    );
  }
  if (s.structure.length > 0) {
    lines.push(
      `โครงสร้างราคาล่าสุด: ${s.structure
        .map(
          (e) =>
            `${e.kind} ${e.direction === "up" ? "ขาขึ้น" : "ขาลง"} ที่ $${fmtNum(e.price)} (${new Date(e.time * 1000).toISOString().slice(0, 10)})`
        )
        .join(" → ")}`
    );
  }

  const f = s.fundamentals;
  lines.push(
    `ปัจจัยพื้นฐาน: P/E ${fmtNum(f.peTTM)} เท่า | P/S ${fmtNum(f.psTTM)} เท่า | อัตรากำไรขั้นต้น ${fmtNum(f.grossMarginTTM)}% | อัตรากำไรสุทธิ ${fmtNum(f.netMarginTTM)}% | รายได้เติบโต YoY ${fmtNum(f.revenueGrowthYoY)}%`
  );
  if (f.week52High !== null || f.week52Low !== null) {
    lines.push(`กรอบ 52 สัปดาห์: $${fmtNum(f.week52Low)} – $${fmtNum(f.week52High)}`);
  }
  if (s.latestQuarter) {
    const lq = s.latestQuarter;
    lines.push(
      `ไตรมาสล่าสุด (${lq.periodLabel}): รายได้ ${fmtUsd(lq.revenue)} | กำไรสุทธิ ${fmtUsd(lq.netIncome)} | กระแสเงินสดอิสระ ${fmtUsd(lq.freeCashFlow)}`
    );
  }

  if (s.analyst) {
    const a = s.analyst;
    lines.push(
      `นักวิเคราะห์ (${a.period}): ซื้อเชิงรุก ${a.strongBuy} / ซื้อ ${a.buy} / ถือ ${a.hold} / ขาย ${a.sell} / ขายเชิงรุก ${a.strongSell} จากทั้งหมด ${a.total} ราย — ${a.label}`
    );
  }

  if (s.earnings) {
    const e = s.earnings.event;
    lines.push(
      `ประกาศผลประกอบการครั้งถัดไป: ${e.date} (อีก ${s.earnings.daysAway} วัน) — คาดการณ์ EPS ${e.epsEstimate ?? "ไม่มีข้อมูล"}`
    );
  }

  if (s.headlines.length > 0) {
    lines.push("ข่าวเด่น:");
    lines.push(...s.headlines.map((n) => `  • [${n.source}] ${n.headline}`));
  }

  if (s.position) {
    const p = s.position;
    lines.push("");
    lines.push(`พอร์ตของคุณใน ${s.symbol}:`);
    lines.push(
      `  ถือ ${fmtShares(p.totalShares)} หุ้น ต้นทุนเฉลี่ย $${fmtNum(p.avgCost)} (ต้นทุนรวม ${fmtUsd(p.costBasis)})`
    );
    lines.push(
      `  มูลค่าปัจจุบัน ${fmtUsd(p.value)} | กำไร/ขาดทุนที่ยังไม่รับรู้ ${fmtSigned(p.unrealizedPnl)} ดอลลาร์ (${fmtSigned(p.unrealizedPnlPercent)}%)`
    );
    lines.push(
      p.breakEvenDistancePercent > 0
        ? `  ราคาต้องขึ้นอีก ${fmtNum(p.breakEvenDistancePercent)}% จึงจะถึงจุดคุ้มทุน`
        : `  ราคาสูงกว่าจุดคุ้มทุนอยู่ ${fmtNum(Math.abs(p.breakEvenDistancePercent))}%`
    );
    if (p.daysHeld !== null) lines.push(`  ถือมาแล้ว ${p.daysHeld} วัน`);
    lines.push(
      `  ประมาณการที่ราคาเป้าหมาย (ค่าตั้งต้น +10% / +25% / +50%): ${p.targets
        .map((t) => `$${t.price} → ${fmtSigned(t.pnl)} ดอลลาร์ (${fmtSigned(t.pnlPercent)}%)`)
        .join(" | ")}`
    );
  }

  return lines.join("\n");
}

function renderPortfolioSection(portfolio: NonNullable<DailySummaryData["portfolio"]>): string {
  return [
    "▌ ภาพรวมพอร์ตรวม",
    `มูลค่ารวม ${fmtUsd(portfolio.totalValue)} | ต้นทุนรวม ${fmtUsd(portfolio.totalCost)}`,
    `กำไร/ขาดทุนที่ยังไม่รับรู้ ${fmtSigned(portfolio.unrealizedPnl)} ดอลลาร์ (${fmtSigned(portfolio.unrealizedPnlPercent)}%)`,
  ].join("\n");
}

/** The numbers half of the email — also the exact context the narrative is written from. */
export function renderDataSections(data: DailySummaryData): string {
  const parts = data.symbols.map(renderSymbolSection);
  if (data.portfolio) parts.push(renderPortfolioSection(data.portfolio));
  return parts.join("\n\n");
}

function buildNarrativePrompt(data: DailySummaryData): string {
  const symbolList = data.symbols.map((s) => s.symbol).join(", ");
  const reads = data.symbols
    .filter((s) => s.read !== null)
    .map(
      (s) =>
        `${s.symbol} — ข้อสังเกตเชิงเทคนิค:\n${s.read!.technical.map((l) => `- ${l}`).join("\n")}\n${s.symbol} — ข้อสังเกตปัจจัยพื้นฐาน:\n${s.read!.fundamental.map((l) => `- ${l}`).join("\n")}\n${s.symbol} — ภาพรวมสัญญาณ: ${s.read!.verdictText}`
    )
    .join("\n\n");

  return `คุณเป็นนักวิเคราะห์การลงทุนมืออาชีพ เขียนบทสรุปหลังปิดตลาดประจำวันให้นักลงทุนรายย่อยชาวไทยที่ถือหุ้น ${symbolList} อยู่จริง

ข้อมูลทั้งหมดด้านล่างนี้ผ่านการคำนวณจากราคาจริง ณ วันนี้แล้ว (OHLC, ปริมาณซื้อขาย, RSI/MACD/MA/Bollinger, แนวรับแนวต้าน, โครงสร้างราคา BOS/CHoCH, อัตราส่วนทางการเงิน, ผลสำรวจนักวิเคราะห์, ข่าว และสถานะพอร์ตจริงของผู้อ่าน):

${renderDataSections(data)}

${reads ? `บทวิเคราะห์เชิงกฎที่ระบบสรุปไว้แล้ว (ใช้เป็นวัตถุดิบ ไม่ต้องลอกซ้ำ):\n\n${reads}\n` : ""}
ตัวเลขดิบทั้งหมดข้างต้นจะถูกแสดงในอีเมลฉบับเดียวกันนี้อยู่แล้ว ผู้อ่านเห็นได้เอง — งานของคุณคือ "ร้อยเรียงให้เห็นภาพรวม" ไม่ใช่ "ไล่อ่านตัวเลขซ้ำ" ให้เชื่อมโยงสัญญาณต่าง ๆ เข้าด้วยกันว่ามันสอดคล้องหรือขัดแย้งกันอย่างไร (เช่น โมเมนตัมเทคนิคกับมูลค่าพื้นฐานไปคนละทางหรือไม่, ปริมาณซื้อขายยืนยันการเคลื่อนไหวของราคาหรือเปล่า, ข่าวหรือกำหนดประกาศผลประกอบการเปลี่ยนบริบทของสัปดาห์นี้อย่างไร, สถานะพอร์ตของผู้อ่านอยู่ตรงไหนเมื่อเทียบกับแนวรับแนวต้านที่มีอยู่) อ้างตัวเลขได้เพียงเท่าที่จำเป็นเพื่อสนับสนุนข้อสังเกตแต่ละข้อ

จัดรูปแบบคำตอบเป็นภาษาไทยดังนี้เท่านั้น (ห้ามใช้ markdown เช่น หัวข้อ ตัวหนา หรือตาราง):
1. ย่อหน้าแรก 2-3 ประโยค: ภาพรวมของวันว่าเกิดอะไรขึ้นและมีความหมายอย่างไรในเชิงบริบท
2. ตามด้วยรายการ 3-5 ข้อ แต่ละข้อขึ้นต้นด้วย "- " และขึ้นบรรทัดใหม่ แต่ละข้อคือข้อสังเกตที่เชื่อมโยงข้อมูลอย่างน้อย 2 ส่วนเข้าด้วยกัน
3. ปิดท้ายด้วย 1 ประโยคว่าสิ่งที่ควรติดตามต่อในวันทำการถัดไปคืออะไร

${TONE_INSTRUCTION} ใช้เฉพาะข้อมูลที่ให้มาเท่านั้น ห้ามเดาหรือแต่งตัวเลขเพิ่ม ห้ามให้คำแนะนำการลงทุนโดยตรง (เช่น ควรซื้อ/ควรขาย/ควรถือต่อ) ให้นำเสนอข้อมูลและมุมมองประกอบการตัดสินใจแทน`;
}

/**
 * Used verbatim when every AI provider is down. Deliberately built from the same
 * rule-based reads the narrative would have been written from, so a fallback email is
 * thinner but never empty or obviously broken.
 */
function renderRuleBasedNarrative(data: DailySummaryData): string {
  const parts = data.symbols
    .filter((s) => s.read !== null)
    .map((s) =>
      [
        `${s.symbol}: ${s.read!.verdictText}`,
        ...s.read!.technical.map((l) => `- ${l}`),
        ...s.read!.fundamental.map((l) => `- ${l}`),
      ].join("\n")
    );
  if (parts.length === 0) {
    return "ไม่สามารถสร้างบทสรุปได้ในขณะนี้ — กรุณาดูตัวเลขดิบด้านบนประกอบครับ";
  }
  return parts.join("\n\n");
}

export function thaiDateLabel(now: Date = new Date()): string {
  // Bangkok time: the email lands at 06:00 ICT, so a UTC-labelled date would read as
  // "yesterday" to the person opening it. Forced to the Gregorian calendar — plain
  // "th-TH" defaults to the Buddhist era ("2569"), which this project deliberately
  // does not show anywhere (see the lot list fix in f6ba012).
  return now.toLocaleDateString("th-TH-u-ca-gregory", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export interface DailySummaryEmail {
  subject: string;
  body: string;
  narrativeSource: "ai" | "rule-based";
  symbols: string[];
}

const DISCLAIMER =
  "⚠️  ไม่ใช่คำแนะนำการลงทุน — ส่วนด้านล่างนี้เขียนโดย AI จากข้อมูลข้างต้น อาจมีความคลาดเคลื่อนหรือตีความผิดพลาดได้ ใช้ประกอบการพิจารณาเท่านั้น การตัดสินใจลงทุนทั้งหมดเป็นความรับผิดชอบของผู้ลงทุนเอง";

export function composeDailySummaryEmail(
  data: DailySummaryData,
  narrative: string,
  narrativeSource: "ai" | "rule-based"
): DailySummaryEmail {
  const dateLabel = thaiDateLabel();
  const divider = "─".repeat(48);

  const body = [
    `สรุปหลังปิดตลาด — ${dateLabel}`,
    divider,
    renderDataSections(data),
    "",
    divider,
    narrativeSource === "ai" ? "บทวิเคราะห์ภาพรวมโดย AI" : "บทวิเคราะห์ภาพรวม (ระบบวิเคราะห์เชิงกฎ)",
    "",
    // Sits directly above the generated prose rather than in a footer, so it's attached
    // to the part it's actually about.
    narrativeSource === "ai"
      ? DISCLAIMER
      : "⚠️  ไม่ใช่คำแนะนำการลงทุน — ผู้ให้บริการ AI ไม่พร้อมใช้งานในขณะนี้ ส่วนด้านล่างจึงมาจากการวิเคราะห์เชิงกฎของระบบ ใช้ประกอบการพิจารณาเท่านั้น",
    "",
    narrative,
    "",
    divider,
    "ส่งอัตโนมัติจาก NVDA Instrument Wall ทุกเช้า 06:00 น. (เวลาไทย)",
  ].join("\n");

  return {
    subject: `สรุปหลังปิดตลาด ${dateLabel}`,
    body,
    narrativeSource,
    symbols: data.symbols.map((s) => s.symbol),
  };
}

/** Collects the data, writes the narrative (AI, else rule-based) and assembles the email. */
export async function buildDailySummaryEmail(): Promise<DailySummaryEmail | null> {
  const data = await collectDailySummary();
  if (data.symbols.length === 0) return null;

  try {
    const narrative = await generateChatReply([
      { role: "user", content: buildNarrativePrompt(data) },
    ]);
    return composeDailySummaryEmail(data, narrative, "ai");
  } catch {
    // Any provider failure at all — missing keys, every key rate-limited, a malformed
    // response — degrades to the rule-based narrative rather than dropping the email.
    return composeDailySummaryEmail(data, renderRuleBasedNarrative(data), "rule-based");
  }
}
