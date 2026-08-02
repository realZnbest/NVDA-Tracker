"use client";

import { useState } from "react";
import { IconBell } from "./icons";
import { useAlertsContext } from "./alerts-provider";
import { AlertsPasswordGate } from "./alerts-password-gate";

export function NotificationBell({ className }: { className?: string }) {
  const { notifications, unreadCount, markRead, authStatus } = useAlertsContext();
  const [open, setOpen] = useState(false);
  const authed = authStatus === "authenticated";

  return (
    <div className={`relative shrink-0 ${className ?? ""}`}>
      <button
        onClick={() => {
          setOpen((v) => !v);
          if (!open && authed) markRead();
        }}
        className="flex items-center gap-1.5 rounded px-1.5 py-1 text-text-secondary hover:text-text-primary transition-colors"
        aria-label="การแจ้งเตือน"
      >
        <IconBell className="h-4 w-4" />
        {authed && unreadCount > 0 && (
          <span className="telemetry rounded-full bg-ch-alert px-1 text-[9px] leading-4 text-bg">
            {unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-10 w-80 module scrollbar-thin max-h-96 overflow-y-auto p-3">
          {authStatus === "not_configured" ? (
            <p className="text-xs text-text-muted py-4 text-center">
              ยังไม่ได้ตั้งค่า ALERTS_PASSWORD บนเซิร์ฟเวอร์
            </p>
          ) : !authed ? (
            <AlertsPasswordGate compact />
          ) : (
            <>
              <div className="module-label mb-2">บันทึกการแจ้งเตือนล่าสุด</div>
              {notifications.length === 0 ? (
                <p className="text-xs text-text-muted py-4 text-center">
                  ยังไม่มีการแจ้งเตือนที่ทริกเกอร์
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {notifications.map((n) => (
                    <li key={n.id} className="border-t border-seam/60 pt-2 first:border-t-0 first:pt-0">
                      <p className="text-xs text-text-primary leading-relaxed">{n.message}</p>
                      <p className="telemetry text-[10px] text-text-muted mt-1">
                        {new Date(n.createdAt).toLocaleString("th-TH")}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
