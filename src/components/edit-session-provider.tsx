"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type RequestLinkResult = "ok" | "rate_limited" | "no_email" | "error";

interface EditSessionContextValue {
  canEdit: boolean;
  loaded: boolean;
  refresh: () => void;
  requestLink: () => Promise<RequestLinkResult>;
  logout: () => Promise<void>;
}

const EditSessionContext = createContext<EditSessionContextValue | null>(null);

export function EditSessionProvider({ children }: { children: React.ReactNode }) {
  const [canEdit, setCanEdit] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(() => {
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((data) => {
        setCanEdit(!!data.authenticated);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const requestLink = useCallback(async (): Promise<RequestLinkResult> => {
    try {
      const res = await fetch("/api/auth/request-link", { method: "POST" });
      const data = await res.json();
      if (data.error === "MISSING_OWNER_EMAIL") return "no_email";
      if (data.error === "RATE_LIMITED") return "rate_limited";
      if (data.error) return "error";
      return "ok";
    } catch {
      return "error";
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setCanEdit(false);
  }, []);

  return (
    <EditSessionContext.Provider value={{ canEdit, loaded, refresh, requestLink, logout }}>
      {children}
    </EditSessionContext.Provider>
  );
}

export function useEditSession() {
  const ctx = useContext(EditSessionContext);
  if (!ctx) throw new Error("useEditSession must be used within EditSessionProvider");
  return ctx;
}
