import { randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { db } from "./db";

export const EDIT_SESSION_COOKIE = "nvda_edit_session";

const MAGIC_LINK_TTL_MS = 15 * 60_000;
const EDIT_SESSION_TTL_MS = 24 * 60 * 60_000;

function randomToken(): string {
  return randomBytes(32).toString("hex");
}

export function createMagicLink(): { token: string; expiresAt: number } {
  const token = randomToken();
  const expiresAt = Date.now() + MAGIC_LINK_TTL_MS;
  db.prepare(
    `INSERT INTO magic_links (token, createdAt, expiresAt, usedAt) VALUES (?, ?, ?, NULL)`
  ).run(token, Date.now(), expiresAt);
  return { token, expiresAt };
}

/** Single-use: marks the link consumed and returns whether it was valid to begin with. */
export function consumeMagicLink(token: string): boolean {
  const row = db.prepare(`SELECT expiresAt, usedAt FROM magic_links WHERE token = ?`).get(token) as
    | { expiresAt: number; usedAt: number | null }
    | undefined;
  if (!row || row.usedAt !== null || row.expiresAt < Date.now()) return false;
  db.prepare(`UPDATE magic_links SET usedAt = ? WHERE token = ?`).run(Date.now(), token);
  return true;
}

export function createEditSession(): { token: string; expiresAt: number } {
  const token = randomToken();
  const expiresAt = Date.now() + EDIT_SESSION_TTL_MS;
  db.prepare(`INSERT INTO edit_sessions (token, createdAt, expiresAt) VALUES (?, ?, ?)`).run(
    token,
    Date.now(),
    expiresAt
  );
  return { token, expiresAt };
}

export function isEditSessionValid(token: string | undefined | null): boolean {
  if (!token) return false;
  const row = db.prepare(`SELECT expiresAt FROM edit_sessions WHERE token = ?`).get(token) as
    | { expiresAt: number }
    | undefined;
  return !!row && row.expiresAt > Date.now();
}

export function destroyEditSession(token: string): void {
  db.prepare(`DELETE FROM edit_sessions WHERE token = ?`).run(token);
}

export function requireEditSession(request: NextRequest): boolean {
  return isEditSessionValid(request.cookies.get(EDIT_SESSION_COOKIE)?.value);
}
