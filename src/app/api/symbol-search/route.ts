import { NextRequest, NextResponse } from "next/server";
import { searchSymbols, FinnhubError } from "@/lib/finnhub";

const MAX_RESULTS = 8;

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) {
    return NextResponse.json({ results: [] });
  }

  try {
    const data = await searchSymbols(q);
    const needle = q.toLowerCase();

    // Finnhub's own ordering isn't relevance-ranked — searching "apple" can put small-cap
    // noise ("Pineapple Financial") ahead of the obvious match. Re-rank ourselves: exact
    // ticker match first, then ticker-starts-with, then company-name-starts-with, then
    // whatever's left in Finnhub's original (stable) order.
    function rank(symbol: string, description: string): number {
      const sym = symbol.toLowerCase();
      if (sym === needle) return 0;
      if (sym.startsWith(needle)) return 1;
      if (description.toLowerCase().startsWith(needle)) return 2;
      return 3;
    }

    // Non-US listings come back with an exchange suffix (e.g. "603020.SS", "2788.T",
    // "PNPL.L") — a plain ticker has none, which is a reliable enough signal to scope
    // this to the US market without a separate exchange lookup.
    //
    // Type isn't just "Common Stock": large, well-known foreign companies trade in the US
    // as ADRs (Taiwan Semiconductor/TSM, Alibaba/BABA, Sony, Novo Nordisk, ...) — Finnhub
    // tags those "ADR" rather than "Common Stock", so restricting to "Common Stock" alone
    // silently excluded an entire category of legitimate, commonly-searched US tickers.
    const ALLOWED_TYPES = new Set(["Common Stock", "ADR"]);
    const results = data.result
      .filter((r) => ALLOWED_TYPES.has(r.type) && !r.symbol.includes("."))
      .map((r) => ({ symbol: r.symbol, description: r.description }))
      .sort((a, b) => rank(a.symbol, a.description) - rank(b.symbol, b.description))
      .slice(0, MAX_RESULTS);
    return NextResponse.json({ results });
  } catch (err) {
    if (err instanceof FinnhubError) {
      return NextResponse.json({ error: err.message }, { status: 200 });
    }
    return NextResponse.json({ error: "UNKNOWN_ERROR" }, { status: 500 });
  }
}
