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

const CHECK_INTERVAL_MS = 90_000;

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

  const checkAlerts = useCallback(async () => {
    try {
      await fetch("/api/alerts/check", { method: "POST" });
    } catch {
      // silent
    } finally {
      fetchNotifications();
    }
  }, [fetchNotifications]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    fetchNotifications();
    checkAlerts();
    timerRef.current = setInterval(checkAlerts, CHECK_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [checkAlerts, fetchNotifications]);

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
