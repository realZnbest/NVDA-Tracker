"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { AlertNotification } from "@/lib/types";

interface AlertsContextValue {
  notifications: AlertNotification[];
  unreadCount: number;
  refresh: () => void;
  markRead: () => void;
}

const AlertsContext = createContext<AlertsContextValue | null>(null);

// Evaluation itself now runs on a server-side schedule (Render Cron Job hitting
// /api/alerts/check independently of any visitor) — the client only needs to poll
// for notifications the cron job may have already written, to keep the badge/bell
// reasonably current while a tab is open.
const REFRESH_INTERVAL_MS = 60_000;

export function AlertsProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AlertNotification[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      const data = await res.json();
      if (Array.isArray(data.notifications)) {
        setNotifications(data.notifications);
      }
    } catch {
      // silent — network hiccups shouldn't disrupt the UI
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    fetchNotifications();
    timerRef.current = setInterval(fetchNotifications, REFRESH_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchNotifications]);

  const markRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? Date.now() })));
    try {
      await fetch("/api/notifications", { method: "POST" });
    } catch {
      // silent
    }
  }, []);

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <AlertsContext.Provider
      value={{ notifications, unreadCount, refresh: fetchNotifications, markRead }}
    >
      {children}
    </AlertsContext.Provider>
  );
}

export function useAlertsContext() {
  const ctx = useContext(AlertsContext);
  if (!ctx) throw new Error("useAlertsContext must be used within AlertsProvider");
  return ctx;
}
