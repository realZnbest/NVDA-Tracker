import crypto from "crypto";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

export const ALERTS_AUTH_COOKIE = "nvda_alerts_auth";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function getSecret(): string | null {
  return process.env.ALERTS_PASSWORD || null;
}

function sign(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function isAlertsConfigured(): boolean {
  return getSecret() !== null;
}

export function checkPassword(candidate: string): boolean {
  const secret = getSecret();
  if (!secret) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function createSessionToken(): string {
  const secret = getSecret();
  if (!secret) throw new Error("MISSING_ALERTS_PASSWORD");
  const expires = String(Date.now() + SESSION_TTL_MS);
  return `${expires}.${sign(expires, secret)}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  const secret = getSecret();
  if (!secret || !token) return false;
  const [expires, sig] = token.split(".");
  if (!expires || !sig) return false;
  if (Date.now() > Number(expires)) return false;
  const expected = sign(expires, secret);
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function isAlertsAuthorized(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(ALERTS_AUTH_COOKIE)?.value);
}

export const SESSION_MAX_AGE_SECONDS = SESSION_TTL_MS / 1000;

/** Returns a 401 response if the request isn't an authenticated owner session, else null. */
export async function requireAlertsAuth(): Promise<NextResponse | null> {
  if (!(await isAlertsAuthorized())) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  return null;
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * A scheduled job can't hold the owner's signed cookie — that's a browser artifact — so
 * routes meant to run unattended accept `Authorization: Bearer $CRON_SECRET` as well.
 * With CRON_SECRET unset the bearer path can never match, so the route stays exactly as
 * locked down as requireAlertsAuth() until the secret is deliberately configured.
 */
export async function isCronAuthorized(): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = (await headers()).get("authorization");
  if (!header?.startsWith("Bearer ")) return false;
  return constantTimeEquals(header.slice("Bearer ".length).trim(), secret);
}

/** Like requireAlertsAuth(), but also lets the scheduled job through via CRON_SECRET. */
export async function requireOwnerOrCron(): Promise<NextResponse | null> {
  if ((await isAlertsAuthorized()) || (await isCronAuthorized())) return null;
  return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
}
