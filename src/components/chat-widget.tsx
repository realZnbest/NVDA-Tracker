"use client";

import { useEffect, useRef, useState } from "react";
import { IconClose, IconSpark } from "./icons";
import type { ChatMessage } from "@/lib/ai-provider";

const MAX_MESSAGE_LENGTH = 500;

type SendStatus = "idle" | "sending" | "rate_limited" | "unavailable";

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<SendStatus>("idle");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, status]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || status === "sending") return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setStatus("sending");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      if (res.status === 429) {
        setStatus("rate_limited");
        return;
      }
      const data = await res.json();
      if (data.error || !data.reply) {
        setStatus("unavailable");
        return;
      }
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      setStatus("idle");
    } catch {
      setStatus("unavailable");
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="module flex w-[360px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-seam px-4 py-2.5">
            <div className="flex items-center gap-1.5">
              <IconSpark className="h-3.5 w-3.5 text-ch-rsi" />
              <span className="module-label">ถามคำถามเกี่ยวกับ NVDA</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-text-muted hover:text-text-primary transition-colors"
              aria-label="ปิด"
            >
              <IconClose className="h-4 w-4" />
            </button>
          </div>

          <div className="border-b border-seam bg-ch-alert-dim/40 px-4 py-2">
            <p className="text-[11px] font-medium leading-relaxed text-ch-alert">
              คำตอบจาก AI อาจไม่ถูกต้องหรือไม่เป็นปัจจุบัน ไม่ใช่คำแนะนำการลงทุน
              โปรดตรวจสอบข้อมูลก่อนตัดสินใจ
            </p>
          </div>

          <div ref={listRef} className="scrollbar-thin flex h-80 flex-col gap-2.5 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <p className="text-xs text-text-muted">ถามอะไรก็ได้เกี่ยวกับ NVDA หรือการลงทุนทั่วไป</p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <p
                  className={`max-w-[85%] whitespace-pre-wrap rounded px-3 py-2 text-xs leading-relaxed ${
                    m.role === "user"
                      ? "bg-ch-price-dim text-text-primary"
                      : "bg-panel-2 text-text-secondary"
                  }`}
                >
                  {m.content}
                </p>
              </div>
            ))}
            {status === "sending" && <p className="text-xs text-text-muted">กำลังตอบ…</p>}
            {status === "rate_limited" && (
              <p className="text-xs text-ch-alert">ถามถี่เกินไป กรุณารอสักครู่แล้วลองใหม่</p>
            )}
            {status === "unavailable" && (
              <p className="text-xs text-ch-alert">ขณะนี้ระบบแชทไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง</p>
            )}
          </div>

          <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-seam p-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
              placeholder="พิมพ์คำถาม…"
              maxLength={MAX_MESSAGE_LENGTH}
              disabled={status === "sending"}
              className="telemetry flex-1 rounded border border-seam bg-panel-2 px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-ch-price disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={status === "sending" || !input.trim()}
              className="rounded bg-ch-price-dim px-3 py-1.5 text-xs text-ch-price transition-colors hover:brightness-125 disabled:opacity-50"
            >
              ส่ง
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="module flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm text-text-primary hover:brightness-110 transition-[filter]"
      >
        <IconSpark className="h-4 w-4 text-ch-rsi" />
        ถามคำถาม
      </button>
    </div>
  );
}
