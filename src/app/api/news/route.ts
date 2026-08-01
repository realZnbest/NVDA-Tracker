import { NextResponse } from "next/server";
import { getCompanyNews, FinnhubError } from "@/lib/finnhub";
import { SYMBOL } from "@/lib/timeframes";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  const to = new Date();
  const from = new Date(to.getTime() - 21 * 24 * 60 * 60 * 1000);

  try {
    const news = await getCompanyNews(SYMBOL, isoDate(from), isoDate(to));
    const cleaned = news
      .filter((n) => n.headline && n.summary)
      .sort((a, b) => b.datetime - a.datetime)
      .slice(0, 40);
    return NextResponse.json({ news: cleaned });
  } catch (err) {
    if (err instanceof FinnhubError) {
      return NextResponse.json({ error: err.message }, { status: 200 });
    }
    return NextResponse.json({ error: "UNKNOWN_ERROR" }, { status: 500 });
  }
}
