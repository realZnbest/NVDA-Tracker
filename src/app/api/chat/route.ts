import { NextRequest, NextResponse } from "next/server";
import {
  getQuote,
  getCompanyNews,
  getReportedFinancials,
} from "@/lib/finnhub";
import { extractAllQuarters } from "@/lib/financial-metrics";
import { generateChatReply, type ChatMessage } from "@/lib/ai-provider";
import { filterRelevantNews } from "@/lib/news-filter";
import { getYahooCompanyName } from "@/lib/yahoo";
import { SYMBOL } from "@/lib/timeframes";
import { getAnalysisRead } from "@/lib/analysis";

// The provider chain can burn 8s per key before falling through to the next one — a
// cold instance with every key rate-limited needs well beyond the platform default.
export const maxDuration = 60;

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 20;
const MAX_MESSAGE_LENGTH = 500;
const MAX_HISTORY = 10;

const requestLog = new Map<string, number[]>();
let lastSweep = 0;

/** Drops empty/expired IP entries once per window, so the map can't grow forever. */
function sweepRequestLog(now: number) {
  if (now - lastSweep < RATE_LIMIT_WINDOW_MS) return;
  lastSweep = now;
  for (const [ip, times] of requestLog) {
    const recent = times.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (recent.length > 0) requestLog.set(ip, recent);
    else requestLog.delete(ip);
  }
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  sweepRequestLog(now);
  const recent = (requestLog.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  // Rejected requests must not extend the window, otherwise a user hammering the
  // button stays blocked forever instead of clearing after 10 minutes.
  if (recent.length >= RATE_LIMIT_MAX) {
    requestLog.set(ip, recent);
    return true;
  }
  recent.push(now);
  requestLog.set(ip, recent);
  return false;
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function fmtUsd(v: number | null) {
  if (v === null) return "ไม่มีข้อมูล";
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  return `$${v.toFixed(2)}`;
}

async function buildChatContext(symbol: string): Promise<string> {
  const parts: string[] = [];

  try {
    const quote = await getQuote(symbol);
    parts.push(
      `ราคาปัจจุบันของ ${symbol}: $${quote.c.toFixed(2)} (${quote.d >= 0 ? "+" : ""}${quote.d.toFixed(2)}, ${quote.dp.toFixed(2)}%). เปิด $${quote.o.toFixed(2)} สูงสุด $${quote.h.toFixed(2)} ต่ำสุด $${quote.l.toFixed(2)} ปิดก่อนหน้า $${quote.pc.toFixed(2)}`
    );
  } catch {
    // omit this piece — one data source failing shouldn't block the whole context
  }

  try {
    const to = new Date();
    const from = new Date(to.getTime() - 14 * 24 * 60 * 60 * 1000);
    const [news, companyName] = await Promise.all([
      getCompanyNews(symbol, isoDate(from), isoDate(to)),
      getYahooCompanyName(symbol),
    ]);
    const items = filterRelevantNews(news, symbol, companyName)
      .sort((a, b) => b.datetime - a.datetime)
      .slice(0, 5);
    if (items.length > 0) {
      parts.push(`ข่าวล่าสุดเกี่ยวกับ ${symbol}:\n${items.map((n) => `- [${n.source}] ${n.headline}`).join("\n")}`);
    }
  } catch {
    // omit
  }

  try {
    const read = await getAnalysisRead(undefined, symbol);
    parts.push(
      `บทวิเคราะห์เชิงเทคนิค (คำนวณจาก RSI/MACD/MA/Bollinger จริง ณ ขณะนี้):\n${read.technical.map((l) => `- ${l}`).join("\n")}`
    );
    parts.push(
      `บทวิเคราะห์ปัจจัยพื้นฐาน (P/E, P/S, อัตรากำไร, การเติบโต):\n${read.fundamental.map((l) => `- ${l}`).join("\n")}`
    );
    parts.push(`ภาพรวมสัญญาณ: ${read.verdictText}`);
    if (read.conflicts.length > 0) {
      parts.push(`สัญญาณที่ขัดกัน:\n${read.conflicts.map((l) => `- ${l}`).join("\n")}`);
    }
  } catch {
    // omit — this piece failing shouldn't block quote/news/reported-financials context
  }

  try {
    const reported = await getReportedFinancials(symbol, "quarterly");
    const quarters = extractAllQuarters(reported).slice(-2);
    if (quarters.length > 0) {
      parts.push(
        `ผลประกอบการล่าสุด:\n${quarters
          .map(
            (q) =>
              `- ${q.periodLabel}: รายได้ ${fmtUsd(q.revenue)}, กำไรสุทธิ ${fmtUsd(q.netIncome)}, อัตรากำไรสุทธิ ${q.netMargin?.toFixed(2) ?? "ไม่มีข้อมูล"}%`
          )
          .join("\n")}`
      );
    }
  } catch {
    // omit
  }

  const dataBlock = parts.length > 0 ? parts.join("\n\n") : "ไม่มีข้อมูลตลาดล่าสุดในขณะนี้";

  return `คุณเป็นนักวิเคราะห์การลงทุนมืออาชีพ ตอบคำถามเป็นภาษาไทยเสมอ น้ำเสียงเป็นทางการ เป็นกลาง ไม่แสดงอารมณ์
ผู้ใช้อาจถามเกี่ยวกับหุ้น ${symbol} โดยเฉพาะ หรือคำถามทั่วไปเกี่ยวกับการลงทุน/ตลาดหุ้นก็ได้ ตอบได้ทั้งสองแบบ

ข้อมูลตลาดล่าสุดของ ${symbol} ด้านล่างนี้ผ่านการคำนวณไว้ให้แล้ว (ราคา, RSI/MACD/MA/Bollinger จริง, อัตราส่วนการเงินจริง, ข่าวจริง) — เมื่อผู้ใช้ถามคำถามเชิงเทคนิคัลหรือปัจจัยพื้นฐาน ให้ตอบโดยอ้างอิงตัวเลข/บทวิเคราะห์ที่ให้มาโดยตรงทันที ห้ามบอกให้ผู้ใช้ไปดูกราฟหรือตัวเลขเอง เพราะข้อมูลเหล่านั้นถูกคำนวณมาให้พร้อมแล้วในนี้ ห้ามเดาหรือแต่งตัวเลขเพิ่มเติมนอกจากที่ให้มา:
${dataBlock}

ห้ามให้คำแนะนำการลงทุนโดยตรง (เช่น ควรซื้อ/ควรขายตอนนี้) ให้นำเสนอข้อมูลและมุมมองประกอบการตัดสินใจแทน ตอบกระชับ ไม่ต้องมีหัวข้อหรือ bullet เว้นแต่จำเป็น`;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  let body: { messages?: unknown; symbol?: unknown };
  try {
    body = (await request.json()) as { messages?: unknown; symbol?: unknown };
  } catch {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const requestedSymbol = typeof body.symbol === "string" ? body.symbol.trim().toUpperCase() : "";
  const symbol = /^[A-Z0-9.^-]{1,12}$/.test(requestedSymbol) ? requestedSymbol : SYMBOL;

  const messages = Array.isArray(body.messages) ? (body.messages as ChatMessage[]) : [];
  const validHistory =
    messages.length > 0 &&
    messages.length <= 50 &&
    messages.every(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.length > 0 &&
        m.content.length <= 8000
    );
  if (!validHistory) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const last = messages[messages.length - 1];
  if (!last || last.role !== "user" || last.content.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const trimmed = messages.slice(-MAX_HISTORY);

  try {
    const context = await buildChatContext(symbol);
    const reply = await generateChatReply(trimmed, context);
    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json({ error: "CHAT_UNAVAILABLE" }, { status: 200 });
  }
}
