import { NextRequest, NextResponse } from "next/server";
import {
  getQuote,
  getCompanyNews,
  getBasicFinancials,
  getReportedFinancials,
} from "@/lib/finnhub";
import { extractAllQuarters } from "@/lib/financial-metrics";
import { generateChatReply, type ChatMessage } from "@/lib/ai-provider";
import { filterRelevantNews } from "@/lib/news-filter";
import { SYMBOL } from "@/lib/timeframes";

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 20;
const MAX_MESSAGE_LENGTH = 500;
const MAX_HISTORY = 10;

const requestLog = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (requestLog.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  requestLog.set(ip, recent);
  return recent.length > RATE_LIMIT_MAX;
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function fmtUsd(v: number | null) {
  if (v === null) return "ไม่มีข้อมูล";
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${v.toFixed(0)}`;
}

async function buildChatContext(): Promise<string> {
  const parts: string[] = [];

  try {
    const quote = await getQuote(SYMBOL);
    parts.push(
      `ราคาปัจจุบันของ NVDA: $${quote.c.toFixed(2)} (${quote.d >= 0 ? "+" : ""}${quote.d.toFixed(2)}, ${quote.dp.toFixed(2)}%). เปิด $${quote.o.toFixed(2)} สูงสุด $${quote.h.toFixed(2)} ต่ำสุด $${quote.l.toFixed(2)} ปิดก่อนหน้า $${quote.pc.toFixed(2)}`
    );
  } catch {
    // omit this piece — one data source failing shouldn't block the whole context
  }

  try {
    const to = new Date();
    const from = new Date(to.getTime() - 14 * 24 * 60 * 60 * 1000);
    const news = await getCompanyNews(SYMBOL, isoDate(from), isoDate(to));
    const items = filterRelevantNews(news)
      .sort((a, b) => b.datetime - a.datetime)
      .slice(0, 5);
    if (items.length > 0) {
      parts.push(`ข่าวล่าสุดเกี่ยวกับ NVDA:\n${items.map((n) => `- [${n.source}] ${n.headline}`).join("\n")}`);
    }
  } catch {
    // omit
  }

  try {
    const basic = await getBasicFinancials(SYMBOL);
    const m = basic.metric;
    parts.push(
      `อัตราส่วนปัจจุบัน: P/E ${m.peNormalizedAnnual ?? m.peTTM ?? "ไม่มีข้อมูล"} เท่า, P/S ${m.psTTM ?? "ไม่มีข้อมูล"} เท่า, รายได้เติบโต YoY ${m.revenueGrowthTTMYoy ?? m.revenueGrowthQuarterlyYoy ?? "ไม่มีข้อมูล"}%`
    );
  } catch {
    // omit
  }

  try {
    const reported = await getReportedFinancials(SYMBOL, "quarterly");
    const quarters = extractAllQuarters(reported).slice(-2);
    if (quarters.length > 0) {
      parts.push(
        `ผลประกอบการล่าสุด:\n${quarters
          .map(
            (q) =>
              `- ${q.periodLabel}: รายได้ ${fmtUsd(q.revenue)}, กำไรสุทธิ ${fmtUsd(q.netIncome)}, อัตรากำไรสุทธิ ${q.netMargin?.toFixed(1) ?? "ไม่มีข้อมูล"}%`
          )
          .join("\n")}`
      );
    }
  } catch {
    // omit
  }

  const dataBlock = parts.length > 0 ? parts.join("\n\n") : "ไม่มีข้อมูลตลาดล่าสุดในขณะนี้";

  return `คุณเป็นนักวิเคราะห์การลงทุนมืออาชีพ ตอบคำถามเป็นภาษาไทยเสมอ น้ำเสียงเป็นทางการ เป็นกลาง ไม่แสดงอารมณ์
ผู้ใช้อาจถามเกี่ยวกับหุ้น NVIDIA (NVDA) โดยเฉพาะ หรือคำถามทั่วไปเกี่ยวกับการลงทุน/ตลาดหุ้นก็ได้ ตอบได้ทั้งสองแบบ

ข้อมูลตลาดล่าสุดของ NVDA ที่ใช้ประกอบคำตอบเมื่อเกี่ยวข้อง (ห้ามเดาหรือแต่งตัวเลขเพิ่มเติมนอกจากนี้):
${dataBlock}

ห้ามให้คำแนะนำการลงทุนโดยตรง (เช่น ควรซื้อ/ควรขายตอนนี้) ให้นำเสนอข้อมูลและมุมมองประกอบการตัดสินใจแทน ตอบกระชับ ไม่ต้องมีหัวข้อหรือ bullet เว้นแต่จำเป็น`;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  const body = (await request.json()) as { messages?: ChatMessage[] };
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const last = messages[messages.length - 1];
  if (!last || last.role !== "user" || !last.content || last.content.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const trimmed = messages.slice(-MAX_HISTORY);

  try {
    const context = await buildChatContext();
    const reply = await generateChatReply(trimmed, context);
    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json({ error: "CHAT_UNAVAILABLE" }, { status: 200 });
  }
}
