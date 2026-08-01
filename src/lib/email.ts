export class EmailError extends Error {}

/**
 * Uses Resend's sandbox sender (onboarding@resend.dev) by default, which can send without
 * domain verification as long as the recipient is the Resend account's own verified email —
 * which is always true here, since every email this app sends goes to OWNER_EMAIL.
 */
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new EmailError("MISSING_RESEND_API_KEY");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM ?? "NVDA Instrument Wall <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new EmailError(`RESEND_HTTP_${res.status}: ${body.slice(0, 200)}`);
  }
}
