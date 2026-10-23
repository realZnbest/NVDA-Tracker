import { WatchlistPanel } from "@/components/watchlist-panel";

export default function WatchlistPage() {
  return (
    <div className="page-container-reading max-sm:px-2 flex flex-col gap-4">
      <div>
        <h1 className="text-display-headline font-medium text-text-primary">รายการติดตาม</h1>
        <p className="mt-1 text-sm text-text-muted">
          หุ้นที่อยากจับตา แต่ยังไม่ได้ถือ — ราคาอัปเดตทุกนาทีขณะเปิดหน้านี้
        </p>
      </div>
      <WatchlistPanel />
    </div>
  );
}
