import type { Metadata } from "next";
import { MarketHeatmapView } from "@/components/market-heatmap-view";

export const metadata: Metadata = {
  title: "ฮีตแมป S&P 500",
  description:
    "ฮีตแมป S&P 500 ครบ 500 บริษัท — พื้นที่ตามมูลค่าตลาด สีตาม % เปลี่ยนแปลง 1 วัน จัดกลุ่มตาม Sector/Industry ของ TradingView พร้อมภาพรวมที่คำนวณจากหุ้นบนแผนที่เดียวกัน",
};

export default function HeatmapPage() {
  return (
    <div className="page-container flex flex-col gap-4 py-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-display-headline font-medium text-text-primary">
          ฮีตแมป S&amp;P 500
        </h1>
        <p className="max-w-4xl text-sm leading-relaxed text-text-muted">
          หุ้นครบ 500 บริษัท · ขนาดตามมูลค่าตลาด · สีตาม % เปลี่ยนแปลง 1 วัน ·
          คลิกหุ้นเพื่อเปิดแดชบอร์ด
        </p>
        <p className="max-w-4xl text-[11px] leading-relaxed text-text-muted">
          Alphabet/Meta อยู่ใน Technology Services · Communications = telecom ·
          ภาพรวมและสีกลุ่มคิดจากหุ้นบนแผนที่เดียวกัน
        </p>
      </header>

      <MarketHeatmapView />
    </div>
  );
}
