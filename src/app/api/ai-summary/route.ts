import { NextRequest, NextResponse } from "next/server";
import {
  getBasicFinancials,
  getCompanyNews,
  getReportedFinancials,
  FinnhubError,
} from "@/lib/finnhub";
import { extractAllQuarters } from "@/lib/financial-metrics";
import { generateSummary, AiError, TONE_INSTRUCTION } from "@/lib/ai-provider";
import { filterRelevantNews } from "@/lib/news-filter";
import { SYMBOL } from "@/lib/timeframes";

type SummaryType = "news" | "financials";

const CACHE_TTL_MS = 60 * 60 * 1000;
// Keyed by "type:symbol" so AAPL's cached summary never serves NVDA's, or vice versa.
const cache = new Map<string, { expires: number; text: string }>();

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function fmtUsd(v: number | null) {
  if (v === null) return "ไม่มีข้อมูล";
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  return `$${v.toFixed(2)}`;
}

async function buildFinancialsPrompt(symbol: string): Promise<string> {
  const [reported, basic] = await Promise.all([
    getReportedFinancials(symbol, "quarterly"),
    getBasicFinancials(symbol),
  ]);
  const quarters = extractAllQuarters(reported).slice(-4);
  const m = basic.metric;

  const lines = quarters.map(
    (q) =>
      `- ${q.periodLabel}: รายได้ ${fmtUsd(q.revenue)}, กำไรสุทธิ ${fmtUsd(q.netIncome)}, ` +
      `อัตรากำไรขั้นต้น ${q.grossMargin?.toFixed(2) ?? "ไม่มีข้อมูล"}%, อัตรากำไรสุทธิ ${q.netMargin?.toFixed(2) ?? "ไม่มีข้อมูล"}%, ` +
      `กระแสเงินสดอิสระ ${fmtUsd(q.freeCashFlow)}`
  );

  return `คุณเป็นนักวิเคราะห์การลงทุนมืออาชีพ ทำหน้าที่สรุปงบการเงินหุ้น ${symbol} ให้นักลงทุนรายย่อยชาวไทย
ข้อมูลงบการเงิน 4 ไตรมาสล่าสุด (เรียงเก่าไปใหม่):
${lines.join("\n")}

อัตราส่วนปัจจุบัน: P/E ${m.peNormalizedAnnual ?? m.peTTM ?? "ไม่มีข้อมูล"} เท่า, P/S ${m.psTTM ?? "ไม่มีข้อมูล"} เท่า, รายได้เติบโต YoY ${m.revenueGrowthTTMYoy ?? m.revenueGrowthQuarterlyYoy ?? "ไม่มีข้อมูล"}%

ข้อมูลตัวเลขดิบทั้งหมดข้างต้นแสดงอยู่ในตารางบนหน้าเว็บอยู่แล้ว ผู้อ่านเห็นตัวเลขได้เอง — งานของคุณคือ "ตีความ" ไม่ใช่ "ท่องซ้ำ" ห้ามไล่รายงานตัวเลขทีละไตรมาสหรือทุกหัวข้อครบถ้วน แต่ให้เลือกเฉพาะประเด็นที่มีนัยสำคัญ (เช่น แนวโน้มกำลังเร่งขึ้น/ชะลอตัว, อัตรากำไรขยายหรือหดตัวและอาจเป็นเพราะอะไร, การเติบโตเทียบกับมูลค่าหุ้นว่าสมเหตุสมผลหรือตึงตัว) แล้วอ้างตัวเลขเพียง 1-2 ตัวต่อข้อเพื่อสนับสนุนข้อสังเกตนั้น ไม่ต้องอ้างครบทุกไตรมาส

จัดรูปแบบคำตอบเป็นภาษาไทยดังนี้เท่านั้น (ห้ามใช้ markdown อื่น เช่น หัวข้อ ตัวหนา หรือตาราง):
1. บรรทัดแรก: ประโยคภาพรวม 1 ประโยคสรุปทิศทางผลประกอบการโดยรวม
2. ตามด้วยรายการ 3-4 ข้อ แต่ละข้อขึ้นต้นด้วย "- " และขึ้นบรรทัดใหม่ แต่ละข้อคือข้อสังเกต/การตีความ 1 ประเด็น ไม่ใช่การสรุปหมวดข้อมูล

${TONE_INSTRUCTION} ใช้เฉพาะตัวเลขที่ให้มาเท่านั้น ห้ามเดาหรือแต่งตัวเลขเพิ่ม ห้ามให้คำแนะนำการลงทุน (เช่น ควรซื้อ/ควรขาย)

ตัวอย่างรูปแบบ (ใช้เป็นแนวโครงสร้างเท่านั้น ไม่ใช่เนื้อหาจริง):
ผลประกอบการล่าสุดของ NVIDIA เติบโตต่อเนื่องแต่เริ่มมีสัญญาณชะลอตัวจากจุดสูงสุดครับ
- อัตราการเติบโตของรายได้ชะลอลงจากไตรมาสก่อนหน้า แม้เทียบปีก่อนยังโตสูงที่ X%
- อัตรากำไรสุทธิขยายตัวต่อเนื่องมาอยู่ที่ X% สะท้อนการควบคุมต้นทุนที่ดีขึ้น
- กระแสเงินสดอิสระยังแข็งแกร่งที่ $X รองรับการลงทุนขยายกำลังผลิตได้
- P/E ที่ X เท่า สะท้อนตลาดยังคาดหวังการเติบโตสูงต่อเนื่อง`;
}

async function buildNewsPrompt(symbol: string): Promise<string> {
  const to = new Date();
  const from = new Date(to.getTime() - 21 * 24 * 60 * 60 * 1000);
  const news = await getCompanyNews(symbol, isoDate(from), isoDate(to));
  const items = filterRelevantNews(news)
    .sort((a, b) => b.datetime - a.datetime)
    .slice(0, 10);

  if (items.length === 0) {
    throw new AiError("NO_NEWS_DATA");
  }

  const lines = items.map((n) => `- [${n.source}] ${n.headline}: ${n.summary}`);

  return `คุณเป็นนักวิเคราะห์การลงทุนมืออาชีพ ทำหน้าที่สรุปข่าวหุ้น ${symbol} ให้นักลงทุนรายย่อยชาวไทย
ข่าวล่าสุด 2 สัปดาห์ที่ผ่านมา:
${lines.join("\n")}

จัดรูปแบบคำตอบเป็นภาษาไทยดังนี้เท่านั้น (ห้ามใช้ markdown อื่น เช่น หัวข้อ ตัวหนา หรือตาราง):
1. บรรทัดแรก: ประโยคภาพรวม 1 ประโยคสรุปว่าข่าวช่วงนี้เกี่ยวกับอะไรเป็นหลัก
2. ตามด้วยรายการ 3-4 ข้อ แต่ละข้อขึ้นต้นด้วย "- " และขึ้นบรรทัดใหม่ แต่ละข้อคือประเด็นข่าวที่แยกจากกันชัดเจน (จับประเด็นที่ข่าวหลายชิ้นพูดตรงกันเป็นข้อเดียว ไม่ต้องแยกทีละข่าว)

${TONE_INSTRUCTION} ใช้เฉพาะข้อมูลที่ให้มาเท่านั้น ห้ามเดาหรือแต่งเพิ่ม ห้ามให้คำแนะนำการลงทุน`;
}

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type") as SummaryType | null;
  if (type !== "news" && type !== "financials") {
    return NextResponse.json({ error: "INVALID_TYPE" }, { status: 400 });
  }
  const symbol = request.nextUrl.searchParams.get("symbol") ?? SYMBOL;
  const cacheKey = `${type}:${symbol}`;

  const hit = cache.get(cacheKey);
  if (hit && hit.expires > Date.now()) {
    return NextResponse.json({ summary: hit.text });
  }

  try {
    const prompt =
      type === "financials" ? await buildFinancialsPrompt(symbol) : await buildNewsPrompt(symbol);
    const summary = await generateSummary(prompt);
    cache.set(cacheKey, { expires: Date.now() + CACHE_TTL_MS, text: summary });
    return NextResponse.json({ summary });
  } catch (err) {
    if (err instanceof AiError || err instanceof FinnhubError) {
      return NextResponse.json({ error: err.message }, { status: 200 });
    }
    return NextResponse.json({ error: "UNKNOWN_ERROR" }, { status: 500 });
  }
}
