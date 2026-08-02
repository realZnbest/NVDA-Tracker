import { NextRequest, NextResponse } from "next/server";
import { getCompanyNews, FinnhubError } from "@/lib/finnhub";
import { filterRelevantNews } from "@/lib/news-filter";
import { SYMBOL } from "@/lib/timeframes";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol") ?? SYMBOL;
  const to = new Date();
  const from = new Date(to.getTime() - 21 * 24 * 60 * 60 * 1000);

  try {
    const news = await getCompanyNews(symbol, isoDate(from), isoDate(to));
    const cleaned = filterRelevantNews(news)
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
