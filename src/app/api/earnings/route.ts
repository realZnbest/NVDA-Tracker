import { NextRequest, NextResponse } from "next/server";
import { getEarningsCalendar, getEarningsSurprises, getReportedFinancials, FinnhubError } from "@/lib/finnhub";
import { getReportedFinancialsFromEdgar } from "@/lib/edgar";
import { SYMBOL } from "@/lib/timeframes";

const DAY = 24 * 60 * 60_000;

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol") ?? SYMBOL;
  try {
    const now = new Date();
    const from = toDateStr(now);
    const to = toDateStr(new Date(now.getTime() + 180 * 24 * 60 * 60_000));
    const [data, surprises, finnhubReported, edgar] = await Promise.all([
      getEarningsCalendar(symbol, from, to),
      // Past results are a bonus; the countdown must still render if this call fails.
      getEarningsSurprises(symbol).catch(() => []),
      // Actual revenue only: revenue estimates are a paid Finnhub feature. Finnhub's
      // reported financials come first; EDGAR fills in when Finnhub lags or is empty.
      getReportedFinancials(symbol, "quarterly").catch(() => null),
      getReportedFinancialsFromEdgar(symbol).catch(() => null),
    ]);
    const REVENUE_CONCEPTS = [
      "us-gaap_Revenues",
      "us-gaap_RevenueFromContractWithCustomerExcludingAssessedTax",
      "us-gaap_SalesRevenueNet",
    ];
    const revenueByEnd = new Map<string, number>();
    for (const source of [finnhubReported, edgar]) {
      for (const row of source?.data ?? []) {
        const end = row.endDate.slice(0, 10);
        if (revenueByEnd.has(end)) continue;
        const item = row.report.ic.find((i) => REVENUE_CONCEPTS.includes(i.concept));
        if (item) revenueByEnd.set(end, item.value);
      }
    }
    // Finnhub lists the same fiscal period under more than one year/quarter label.
    const seen = new Set<string>();
    // Finnhub's `period` is calendar-aligned (e.g. 09-30) while EDGAR uses the company's own
    // fiscal quarter end (NVDA: 07-26), so take the latest EDGAR quarter ending shortly before it.
    const revenueNear = (period: string): number | null => {
      const target = Date.parse(period);
      let best: { gap: number; value: number } | null = null;
      for (const [end, value] of revenueByEnd) {
        const gap = target - Date.parse(end);
        if (gap >= 0 && gap <= 75 * DAY && (!best || gap < best.gap)) best = { gap, value };
      }
      return best?.value ?? null;
    };
    const history = surprises
      .filter((e) => e.actual !== null && e.estimate !== null)
      .sort((a, b) => b.period.localeCompare(a.period))
      .filter((e) => !seen.has(e.period) && seen.add(e.period))
      .slice(0, 4)
      .map((e) => ({ ...e, revenue: revenueNear(e.period) }));
    const todayStr = toDateStr(now);
    const upcoming = data.earningsCalendar
      .filter((e) => e.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    return NextResponse.json({ event: upcoming ?? null, history });
  } catch (err) {
    if (err instanceof FinnhubError && err.message === "MISSING_API_KEY") {
      return NextResponse.json({ error: "MISSING_API_KEY" }, { status: 200 });
    }
    return NextResponse.json({ error: "UNKNOWN_ERROR" }, { status: 200 });
  }
}
