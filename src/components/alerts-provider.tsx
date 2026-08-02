"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { AlertNotification } from "@/lib/types";

type AuthStatus = "checking" | "authenticated" | "unauthenticated" | "not_configured";

interface AlertsContextValue {
  notifications: AlertNotification[];
  unreadCount: number;
  refresh: () => void;
  markRead: () => void;
  authStatus: AuthStatus;
  login: (password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AlertsContext = createContext<AlertsContextValue | null>(null);

const CHECK_INTERVAL_MS = 90_000;

export function AlertsProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AlertNotification[]>([]);
  const [authStatus, setAuthStatus] = useState<AuthStatus>("checking");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (res.status === 401) return;
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
      const res = await fetch("/api/alerts/check", { method: "POST" });
      if (res.status === 401) return;
    } catch {
      // silent
    } finally {
      fetchNotifications();
    }
  }, [fetchNotifications]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/alerts")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (!data.configured) return setAuthStatus("not_configured");
        setAuthStatus(data.authenticated ? "authenticated" : "unauthenticated");
      })
      .catch(() => !cancelled && setAuthStatus("unauthenticated"));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    checkAlerts();
    timerRef.current = setInterval(checkAlerts, CHECK_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [authStatus, checkAlerts]);

  const login = useCallback(async (password: string) => {
    const res = await fetch("/api/auth/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setAuthStatus("authenticated");
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/alerts", { method: "DELETE" });
    setNotifications([]);
    setAuthStatus("unauthenticated");
  }, []);

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
      value={{
        notifications,
        unreadCount,
        refresh: fetchNotifications,
        markRead,
        authStatus,
        login,
        logout,
      }}
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
