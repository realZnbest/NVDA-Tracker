/**
 * Returns whether the mail was actually handed off to Resend — callers that fire and
 * forget (alert evaluation) ignore it, while the daily-summary cron reports it back so an
 * unconfigured or failing Resend shows up in the workflow log instead of silently
 * producing no email.
 */
export async function sendAlertEmail(subject: string, body: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_EMAIL_TO;
  if (!apiKey || !to) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "NVDA Instrument Wall <onboarding@resend.dev>",
        to,
        subject: `[NVDA] ${subject}`,
        text: body,
      }),
    });
    return res.ok;
  } catch {
    // best-effort — never let an email failure block alert evaluation
    return false;
  }
}
