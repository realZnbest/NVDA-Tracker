export async function sendAlertEmail(subject: string, body: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_EMAIL_TO;
  if (!apiKey || !to) return;
  try {
    await fetch("https://api.resend.com/emails", {
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
  } catch {
    // best-effort — never let an email failure block alert evaluation
  }
}
