import { NextResponse } from "next/server";
import { requireOwnerOrCron } from "@/lib/alerts-auth";
import { buildDailySummaryEmail } from "@/lib/daily-summary";
import { sendAlertEmail } from "@/lib/email";

// Composing the email fans out across every data provider plus the AI chain, and on a
// cold serverless instance none of those caches are warm — 60s covers the worst case.
export const maxDuration = 60;

/**
 * The after-market daily digest, triggered by the GitHub Actions cron at 23:00 UTC
 * (06:00 Thailand time). POST — same shape and gating philosophy as /api/alerts/check,
 * with the added CRON_SECRET bearer path since a scheduled job can't carry the owner's
 * session cookie. Also callable by hand from a logged-in browser session for testing.
 */
/**
 * Preview: composes the exact same email and returns it as plain text without sending.
 * Same gate as POST, so it's the way to eyeball a change to the wording or the numbers
 * without burning a Resend send (or waiting until 06:00).
 */
export async function GET() {
  const unauth = await requireOwnerOrCron();
  if (unauth) return unauth;

  const email = await buildDailySummaryEmail();
  if (!email) {
    return NextResponse.json({ error: "NO_DATA" }, { status: 200 });
  }
  return new NextResponse(`${email.subject}\n\n${email.body}`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function POST() {
  const unauth = await requireOwnerOrCron();
  if (unauth) return unauth;

  try {
    const email = await buildDailySummaryEmail();
    if (!email) {
      return NextResponse.json({ sent: false, error: "NO_DATA" }, { status: 200 });
    }

    // Awaited, unlike alert emails: this route's entire purpose is the send, and the
    // process may be torn down the moment the response is returned.
    const sent = await sendAlertEmail(email.subject, email.body);

    return NextResponse.json({
      sent,
      narrativeSource: email.narrativeSource,
      symbols: email.symbols,
      subject: email.subject,
    });
  } catch {
    return NextResponse.json({ sent: false, error: "UNKNOWN_ERROR" }, { status: 500 });
  }
}
