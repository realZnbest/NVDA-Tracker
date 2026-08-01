import { NextResponse } from "next/server";
import { getQuote, FinnhubError } from "@/lib/finnhub";
import { SYMBOL } from "@/lib/timeframes";

export async function GET() {
  try {
    const quote = await getQuote(SYMBOL);
    return NextResponse.json({ quote });
  } catch (err) {
    if (err instanceof FinnhubError) {
      return NextResponse.json({ error: err.message }, { status: 200 });
    }
    return NextResponse.json({ error: "UNKNOWN_ERROR" }, { status: 500 });
  }
}
