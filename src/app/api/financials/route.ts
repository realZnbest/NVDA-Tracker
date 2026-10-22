import { NextRequest, NextResponse } from "next/server";
import {
  getBasicFinancials,
  getReportedFinancials,
  getEarningsCalendar,
  FinnhubError,
  type FinnhubReportedFinancials,
  type FinnhubEarningsEvent,
} from "@/lib/finnhub";
import { getReportedFinancialsFromEdgar, assignFiscalQuarters } from "@/lib/edgar";
import { SYMBOL } from "@/lib/timeframes";

const STALE_DAYS = 90;

function mergeFinancials(
  finhub: FinnhubReportedFinancials,
  edgar: FinnhubReportedFinancials
): FinnhubReportedFinancials {
  // Finnhub endDates look like "2010-05-02 00:00:00"; EDGAR uses "2026-04-26".
  // Normalize to "YYYY-MM-DD" so the two sources dedupe on the same quarter.
  const norm = (d: string) => String(d).slice(0, 10);
  const byEnd = new Map(finhub.data.map((e) => [norm(e.endDate), e]));
  for (const e of edgar.data) {
    const key = norm(e.endDate);
    if (!byEnd.has(key)) {
      byEnd.set(key, { ...e, endDate: key });
    }
  }
  const data = Array.from(byEnd.values())
    .map((e) => ({ ...e, endDate: norm(e.endDate) }))
    .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());
  return { data };
}

function earningsToReported(
  events: FinnhubEarningsEvent[],
  knownData: FinnhubReportedFinancials
): FinnhubReportedFinancials {
  // The same "YYYY-MM-DD" normalization as mergeFinancials, otherwise the guard below
  // can never match Finnhub's "YYYY-MM-DD 00:00:00" endDates and duplicates slip through.
  const norm = (d: string) => String(d).slice(0, 10);
  const knownEnds = new Set(knownData.data.map((e) => norm(e.endDate)));

  if (knownData.data.length === 0) return { data: [] };

  // The latest reported quarter end is our anchor — the missing quarter is ~3 months
  // later. Falls back to a ~1 month shift off the earnings date if no anchor exists.
  const anchor = knownData.data.reduce(
    (latest, e) =>
      new Date(e.endDate) > new Date(latest) ? e.endDate : latest,
    knownData.data[0]?.endDate ?? ""
  );

  const base = knownData.data.reduce(
    (latest, e) => (new Date(e.endDate) > new Date(latest.endDate) ? e : latest),
    knownData.data[0]
  );

  const entries = events
    .filter((e) => e.epsActual !== null || e.revenueActual !== null)
    .map((e) => {
      let end: Date;
      if (anchor && e.quarter !== null && e.year !== null) {
        const totalOffset = (e.year - base.year) * 4 + (e.quarter - base.quarter);
        end = new Date(anchor);
        end.setMonth(end.getMonth() + 3 * totalOffset);
      } else {
        end = new Date(e.date);
        end.setDate(end.getDate() - 30);
      }
      const endStr = end.toISOString().slice(0, 10);
      if (knownEnds.has(endStr)) return null;
      return {
        year: e.year,
        quarter: e.quarter,
        form: "10-Q",
        startDate: "",
        endDate: endStr,
        report: {
          bs: [],
          ic: [
            ...(e.revenueActual !== null
              ? [{ concept: "us-gaap_Revenues", label: "Revenues", value: e.revenueActual }]
              : []),
            ...(e.epsActual !== null
              ? [{ concept: "us-gaap_EarningsPerShareDiluted", label: "Earnings per share, diluted", value: e.epsActual }]
              : []),
          ],
          cf: [],
        },
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);

  return { data: entries };
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol") ?? SYMBOL;
  try {
    const [reported, metrics] = await Promise.all([
      getReportedFinancials(symbol, "quarterly"),
      getBasicFinancials(symbol),
    ]);

    let finalReported: FinnhubReportedFinancials | null = reported;

    if (reported?.data?.length) {
      const latestEnd = reported.data.reduce(
        (latest, e) =>
          new Date(e.endDate) > new Date(latest) ? e.endDate : latest,
        reported.data[0].endDate
      );
      const daysSince =
        (Date.now() - new Date(latestEnd).getTime()) / (1000 * 60 * 60 * 24);

      if (daysSince > STALE_DAYS) {
        const edgarData = await getReportedFinancialsFromEdgar(symbol);
        if (edgarData?.data?.length) {
          assignFiscalQuarters(reported, edgarData);
          finalReported = mergeFinancials(reported, edgarData);
        } else {
          // EDGAR unreachable (dev/private IP) — fall back to Finnhub's earnings
          // calendar, which does carry the latest quarter's revenue & EPS even when
          // /stock/financials-reported lags behind.
          const today = new Date();
          const from = new Date(today.getTime() - 400 * 24 * 60 * 60_000)
            .toISOString()
            .slice(0, 10);
          const to = today.toISOString().slice(0, 10);
          try {
            const cal = await getEarningsCalendar(symbol, from, to);
            const partial = earningsToReported(cal.earningsCalendar ?? [], reported);
            if (partial.data.length) {
              finalReported = mergeFinancials(reported, partial);
            }
          } catch {
            // ignore — keep Finnhub's (stale) reported data
          }
        }
      }
    } else {
      // Either Finnhub returned no rows or returned an empty data array — both mean
      // nothing to show from the primary source, so try EDGAR.
      const edgarData = await getReportedFinancialsFromEdgar(symbol);
      if (edgarData?.data?.length) {
        assignFiscalQuarters({ data: [] }, edgarData);
        finalReported = edgarData;
      }
    }

    return NextResponse.json({ reported: finalReported, metrics: metrics.metric });
  } catch (err) {
    if (err instanceof FinnhubError) {
      return NextResponse.json({ error: err.message }, { status: 200 });
    }
    return NextResponse.json({ error: "UNKNOWN_ERROR" }, { status: 500 });
  }
}