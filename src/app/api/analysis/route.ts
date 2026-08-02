import { NextResponse } from "next/server";
import { FinnhubError } from "@/lib/finnhub";
import { AnalysisDataError, getAnalysisRead } from "@/lib/analysis";

export async function GET() {
  try {
    const read = await getAnalysisRead();
    return NextResponse.json({ read });
  } catch (err) {
    if (err instanceof AnalysisDataError) {
      return NextResponse.json({ error: err.message }, { status: 200 });
    }
    if (err instanceof FinnhubError) {
      return NextResponse.json({ error: err.message }, { status: 200 });
    }
    return NextResponse.json({ error: "UNKNOWN_ERROR" }, { status: 500 });
  }
}
