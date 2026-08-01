"use client";

import { useEffect, useState } from "react";
import { IconExternal } from "./icons";
import type { FinnhubNewsItem } from "@/lib/finnhub";

export function NewsList() {
  const [news, setNews] = useState<FinnhubNewsItem[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "no_key">("loading");

  useEffect(() => {
    fetch("/api/news")
      .then((r) => r.json())
      .then((data) => {
        if (data.error === "MISSING_API_KEY") return setStatus("no_key");
        if (data.error || !data.news) return setStatus("error");
        setNews(data.news);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  if (status === "loading") {
    return <p className="text-sm text-text-muted px-1">กำลังโหลดข่าว…</p>;
  }
  if (status === "no_key") {
    return <p className="text-sm text-text-muted px-1">ต้องตั้งค่า FINNHUB_API_KEY ก่อนจึงจะดึงข่าวได้</p>;
  }
  if (status === "error") {
    return <p className="text-sm text-text-muted px-1">โหลดข่าวไม่สำเร็จ ลองรีเฟรชอีกครั้ง</p>;
  }
  if (news.length === 0) {
    return <p className="text-sm text-text-muted px-1">ไม่พบข่าวล่าสุดเกี่ยวกับ NVDA ในช่วงนี้</p>;
  }

  return (
    <div className="flex flex-col">
      {news.map((item, i) => (
        <a
          key={item.id}
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className={`group flex gap-4 px-1 py-4 ${i !== 0 ? "border-t border-seam" : ""}`}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 telemetry text-[10px] text-text-muted">
              <span className="text-ch-price">{item.source}</span>
              <span>·</span>
              <time>{new Date(item.datetime * 1000).toLocaleString("th-TH")}</time>
            </div>
            <h3 className="text-sm font-medium text-text-primary leading-snug group-hover:text-ch-price transition-colors">
              {item.headline}
            </h3>
            <p className="mt-1.5 text-xs text-text-secondary leading-relaxed line-clamp-2">
              {item.summary}
            </p>
          </div>
          {item.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.image}
              alt=""
              className="hidden sm:block h-20 w-28 shrink-0 rounded object-cover border border-seam"
            />
          )}
          <IconExternal className="hidden sm:block h-3.5 w-3.5 shrink-0 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
        </a>
      ))}
    </div>
  );
}
