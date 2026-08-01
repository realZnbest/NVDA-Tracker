import { NextRequest, NextResponse } from "next/server";
import { getQuote, FinnhubError } from "@/lib/finnhub";
import { getYahooCandles } from "@/lib/yahoo";
import { SYMBOL } from "@/lib/timeframes";
import { evaluateAlerts } from "@/lib/evaluate-alerts";
import { getPosition } from "@/lib/position-store";
import { sendEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("x-cron-secret") !== cronSecret) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const [candles, quote] = await Promise.all([
      getYahooCandles(SYMBOL, "2y", "1d"),
      getQuote(SYMBOL),
    ]);
    if (candles.s !== "ok" || candles.c.length < 30) {
      return NextResponse.json({ fired: [] });
    }
    const position = getPosition();
    const fired = evaluateAlerts({ price: quote.c, closes: candles.c, position });

    const ownerEmail = process.env.OWNER_EMAIL;
    if (ownerEmail && fired.length > 0) {
      // Best-effort — a broken email provider shouldn't hide the in-app notifications
      // that already got written to the database above.
      await Promise.allSettled(
        fired.map((notification) =>
          sendEmail({
            to: ownerEmail,
            subject: "การแจ้งเตือน NVDA — NVDA Instrument Wall",
            html: `<p>${notification.message}</p><p style="color:#888;font-size:12px">${new Date(notification.createdAt).toLocaleString("th-TH")}</p>`,
          })
        )
      );
    }

    return NextResponse.json({ fired });
  } catch (err) {
    if (err instanceof FinnhubError) {
      return NextResponse.json({ error: err.message }, { status: 200 });
    }
    return NextResponse.json({ error: "UNKNOWN_ERROR" }, { status: 500 });
  }
}
