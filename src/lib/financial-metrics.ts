import type { FinnhubReportedFinancials } from "./finnhub";

type LineItem = { concept: string; label: string; value: number };

function findValue(items: LineItem[] | undefined, candidates: string[]): number | null {
  if (!items) return null;
  for (const candidate of candidates) {
    const hit = items.find((item) =>
      item.label.toLowerCase().includes(candidate.toLowerCase())
    );
    if (hit) return hit.value;
  }
  return null;
}

export interface QuarterMetrics {
  periodLabel: string;
  endDate: string;
  revenue: number | null;
  netIncome: number | null;
  eps: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  totalDebt: number | null;
  operatingCashFlow: number | null;
  capex: number | null;
  freeCashFlow: number | null;
  netMargin: number | null;
  grossMargin: number | null;
}

export function extractQuarterMetrics(
  report: FinnhubReportedFinancials["data"][number]
): QuarterMetrics {
  const { ic, bs, cf } = report.report;

  const revenue = findValue(ic, ["total revenue", "revenues", "net revenue", "sales"]);
  const netIncome = findValue(ic, ["net income", "net earnings"]);
  const eps = findValue(ic, ["diluted", "earnings per share"]);
  const grossProfit = findValue(ic, ["gross profit", "gross margin"]);
  const operatingIncome = findValue(ic, ["operating income", "income from operations"]);

  const longTermDebt = findValue(bs, ["long-term debt", "long term debt"]);
  const shortTermDebt = findValue(bs, ["short-term debt", "current portion of long-term debt"]);
  const totalDebt = longTermDebt !== null ? longTermDebt + (shortTermDebt ?? 0) : shortTermDebt;

  const operatingCashFlow = findValue(cf, [
    "net cash provided by operating",
    "cash from operating",
    "operating activities",
  ]);
  const capex = findValue(cf, ["purchases of property", "capital expenditures", "property and equipment"]);
  const freeCashFlow =
    operatingCashFlow !== null && capex !== null ? operatingCashFlow - Math.abs(capex) : null;

  return {
    periodLabel: `Q${report.quarter} ${report.year}`,
    endDate: report.endDate,
    revenue,
    netIncome,
    eps,
    grossProfit,
    operatingIncome,
    totalDebt,
    operatingCashFlow,
    capex,
    freeCashFlow,
    netMargin: revenue && netIncome !== null ? (netIncome / revenue) * 100 : null,
    grossMargin: revenue && grossProfit !== null ? (grossProfit / revenue) * 100 : null,
  };
}

export function extractAllQuarters(data: FinnhubReportedFinancials): QuarterMetrics[] {
  return data.data
    .slice()
    .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime())
    .map(extractQuarterMetrics);
}
