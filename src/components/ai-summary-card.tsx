"use client";

import { useEffect, useState } from "react";
import { IconSpark } from "./icons";

type Status = "loading" | "ready" | "error" | "no_key" | "no_data";

export function AiSummaryCard({ type }: { type: "news" | "financials" }) {
  const [summary, setSummary] = useState("");
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/ai-summary?type=${type}`)
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
  }, [type]);

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
        {status === "ready" && <p className="text-sm text-text-primary leading-relaxed">{summary}</p>}
      </div>
    </div>
  );
}
