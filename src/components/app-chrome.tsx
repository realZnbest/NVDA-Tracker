"use client";

import { usePathname } from "next/navigation";
import { RackNav } from "./rack-nav";

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === "/";

  return (
    <>
      {!isLanding && <RackNav />}
      <main className="flex-1 min-w-0">{children}</main>
    </>
  );
}
