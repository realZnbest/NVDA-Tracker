"use client";

import { useEffect, useState } from "react";
import { IconSpark } from "./icons";

type Status = "loading" | "ready" | "error" | "no_key" | "no_data";

export function AiSummaryCard({
  type,
  symbol = "NVDA",
}: {
  type: "news" | "financials";
  symbol?: string;
}) {
  const [summary, setSummary] = useState("");
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetch(`/api/ai-summary?type=${type}&symbol=${symbol}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error === "MISSING_AI_API_KEY") return setStatus("no_key");
        if (data.error === "NO_NEWS_DATA") return setStatus("no_data");
        if (data.error || !data.summary) return setStatus("error");
        setSummary(data.summary);
        setStatus("ready");
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
    };
  }, [type, symbol]);

  return (
    <div className="module-galaxy">
      <div className="module p-4">
        <div className="flex items-center gap-2 mb-2">
          <IconSpark className="h-3.5 w-3.5 text-ch-rsi" />
          <span className="module-label module-galaxy-label">สรุปโดย AI</span>
        </div>

        {status === "loading" && <p className="text-sm text-text-muted">กำลังสรุปให้…</p>}
        {status === "no_key" && (
          <p className="text-sm text-text-muted">ต้องตั้งค่า API key ของผู้ให้บริการ AI อย่างน้อย 1 เจ้าก่อนจึงจะสรุปด้วย AI ได้</p>
        )}
        {status === "no_data" && (
          <p className="text-sm text-text-muted">
            {type === "news" ? "ยังไม่มีข่าวพอให้สรุปในช่วงนี้" : "ยังไม่มีข้อมูลงบการเงินพอให้สรุป"}
          </p>
        )}
        {status === "error" && <p className="text-sm text-text-muted">สรุปด้วย AI ไม่สำเร็จ ลองรีเฟรชอีกครั้ง</p>}
        {status === "ready" && <SummaryContent text={summary} />}
      </div>
    </div>
  );
}

/** Splits the model's reply into an intro line plus "- "-prefixed bullet lines and
 * renders them as actual separate lines — a plain <p> collapses newlines, which made a
 * multi-point summary read as one dense run-on paragraph. */
function SummaryContent({ text }: { text: string }) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const bullets = lines.filter((l) => l.startsWith("- "));
  const intro = lines.filter((l) => !l.startsWith("- "));

  if (bullets.length === 0) {
    return <p className="text-sm text-text-primary leading-relaxed">{text}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {intro.map((line, i) => (
        <p key={i} className="text-sm text-text-primary leading-relaxed">
          {line}
        </p>
      ))}
      <ul className="flex flex-col gap-1.5">
        {bullets.map((line, i) => (
          <li
            key={i}
            className="text-sm text-text-secondary leading-relaxed pl-3 relative before:content-['·'] before:absolute before:left-0 before:text-ch-rsi"
          >
            {line.slice(2)}
          </li>
        ))}
      </ul>
    </div>
  );
}
