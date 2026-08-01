import { NextRequest, NextResponse } from "next/server";
import {
  getBasicFinancials,
  getCompanyNews,
  getReportedFinancials,
  FinnhubError,
} from "@/lib/finnhub";
import { extractAllQuarters } from "@/lib/financial-metrics";
import { generateSummary, AiError } from "@/lib/ai-provider";
import { filterRelevantNews } from "@/lib/news-filter";
import { SYMBOL } from "@/lib/timeframes";

type SummaryType = "news" | "financials";

const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<SummaryType, { expires: number; text: string }>();

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function fmtUsd(v: number | null) {
  if (v === null) return "ไม่มีข้อมูล";
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${v.toFixed(0)}`;
}

async function buildFinancialsPrompt(): Promise<string> {
  const [reported, basic] = await Promise.all([
    getReportedFinancials(SYMBOL, "quarterly"),
    getBasicFinancials(SYMBOL),
  ]);
  const quarters = extractAllQuarters(reported).slice(-4);
  const m = basic.metric;

  const lines = quarters.map(
    (q) =>
      `- ${q.periodLabel}: รายได้ ${fmtUsd(q.revenue)}, กำไรสุทธิ ${fmtUsd(q.netIncome)}, ` +
      `อัตรากำไรขั้นต้น ${q.grossMargin?.toFixed(1) ?? "ไม่มีข้อมูล"}%, อัตรากำไรสุทธิ ${q.netMargin?.toFixed(1) ?? "ไม่มีข้อมูล"}%, ` +
      `กระแสเงินสดอิสระ ${fmtUsd(q.freeCashFlow)}`
  );

  return `คุณเป็นผู้ช่วยสรุปงบการเงินหุ้น NVIDIA (NVDA) ให้นักลงทุนรายย่อยชาวไทยอ่านง่าย
ข้อมูลงบการเงิน 4 ไตรมาสล่าสุด (เรียงเก่าไปใหม่):
${lines.join("\n")}

อัตราส่วนปัจจุบัน: P/E ${m.peNormalizedAnnual ?? m.peTTM ?? "ไม่มีข้อมูล"} เท่า, P/S ${m.psTTM ?? "ไม่มีข้อมูล"} เท่า, รายได้เติบโต YoY ${m.revenueGrowthTTMYoy ?? m.revenueGrowthQuarterlyYoy ?? "ไม่มีข้อมูล"}%

เขียนสรุปภาษาไทย 2-3 ประโยค โทนกันเองเหมือนเพื่อนเล่าให้ฟัง (ตัวอย่างสไตล์: "ไตรมาสนี้ AI ชิปขายดีจนงบโต แต่ระวังเรื่อง Supply Chain") ใช้เฉพาะตัวเลขที่ให้มาเท่านั้น ห้ามเดาหรือแต่งตัวเลขเพิ่ม ห้ามให้คำแนะนำการลงทุน (เช่น ควรซื้อ/ควรขาย) ตอบเป็นข้อความล้วน ไม่ต้องมีหัวข้อหรือ bullet`;
}

async function buildNewsPrompt(): Promise<string> {
  const to = new Date();
  const from = new Date(to.getTime() - 21 * 24 * 60 * 60 * 1000);
  const news = await getCompanyNews(SYMBOL, isoDate(from), isoDate(to));
  const items = filterRelevantNews(news)
    .sort((a, b) => b.datetime - a.datetime)
    .slice(0, 10);

  if (items.length === 0) {
    throw new AiError("NO_NEWS_DATA");
  }

  const lines = items.map((n) => `- [${n.source}] ${n.headline}: ${n.summary}`);

  return `คุณเป็นผู้ช่วยสรุปข่าวหุ้น NVIDIA (NVDA) ให้นักลงทุนรายย่อยชาวไทยอ่านง่าย
ข่าวล่าสุด 2 สัปดาห์ที่ผ่านมา:
${lines.join("\n")}

เขียนสรุปภาษาไทย 2-4 ประโยค โทนกันเองเหมือนเพื่อนเล่าให้ฟัง จับประเด็นสำคัญที่ข่าวหลายชิ้นพูดตรงกัน ใช้เฉพาะข้อมูลที่ให้มาเท่านั้น ห้ามเดาหรือแต่งเพิ่ม ห้ามให้คำแนะนำการลงทุน ตอบเป็นข้อความล้วน ไม่ต้องมีหัวข้อหรือ bullet`;
}

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type") as SummaryType | null;
  if (type !== "news" && type !== "financials") {
    return NextResponse.json({ error: "INVALID_TYPE" }, { status: 400 });
  }

  const hit = cache.get(type);
  if (hit && hit.expires > Date.now()) {
    return NextResponse.json({ summary: hit.text });
  }

  try {
    const prompt = type === "financials" ? await buildFinancialsPrompt() : await buildNewsPrompt();
    const summary = await generateSummary(prompt);
    cache.set(type, { expires: Date.now() + CACHE_TTL_MS, text: summary });
    return NextResponse.json({ summary });
  } catch (err) {
    if (err instanceof AiError || err instanceof FinnhubError) {
      return NextResponse.json({ error: err.message }, { status: 200 });
    }
    return NextResponse.json({ error: "UNKNOWN_ERROR" }, { status: 500 });
  }
}
