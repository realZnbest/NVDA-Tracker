import type { FinnhubReportedFinancials } from "./finnhub";

type LineItem = { concept: string; label: string; value: number };

/**
 * Matches by exact XBRL concept tag first (stable across filings, unambiguous), then
 * falls back to a whole-word label match. A naive label substring match is not safe here:
 * e.g. "sales" is a substring of "Sales, general and administrative", which would get
 * mismatched as revenue.
 */
function findByConceptOrLabel(
  items: LineItem[] | undefined,
  concepts: string[],
  labelWords: string[]
): number | null {
  if (!items) return null;
  for (const concept of concepts) {
    const hit = items.find((item) => item.concept === concept);
    if (hit) return hit.value;
  }
  for (const word of labelWords) {
    const re = new RegExp(`\\b${word}\\b`, "i");
    const hit = items.find((item) => re.test(item.label));
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

  const revenue = findByConceptOrLabel(
    ic,
    ["us-gaap_Revenues", "us-gaap_RevenueFromContractWithCustomerExcludingAssessedTax", "us-gaap_SalesRevenueNet"],
    ["total revenue", "^revenue$", "net revenue"]
  );
  const netIncome = findByConceptOrLabel(
    ic,
    ["us-gaap_NetIncomeLoss"],
    ["net income", "net earnings"]
  );
  const eps = findByConceptOrLabel(
    ic,
    ["us-gaap_EarningsPerShareDiluted", "us-gaap_EarningsPerShareBasic"],
    ["diluted"]
  );
  const grossProfit = findByConceptOrLabel(ic, ["us-gaap_GrossProfit"], ["gross profit"]);
  const operatingIncome = findByConceptOrLabel(
    ic,
    ["us-gaap_OperatingIncomeLoss"],
    ["operating income", "income from operations"]
  );

  const longTermDebt = findByConceptOrLabel(
    bs,
    ["us-gaap_LongTermDebtNoncurrent", "us-gaap_LongTermDebt"],
    ["long-term debt", "long term debt"]
  );
  const shortTermDebt = findByConceptOrLabel(
    bs,
    ["us-gaap_DebtCurrent", "us-gaap_ShortTermBorrowings", "us-gaap_LongTermDebtCurrent"],
    ["short-term debt", "short term debt"]
  );
  const totalDebt = longTermDebt !== null ? longTermDebt + (shortTermDebt ?? 0) : shortTermDebt;

  const operatingCashFlow = findByConceptOrLabel(
    cf,
    ["us-gaap_NetCashProvidedByUsedInOperatingActivities"],
    ["net cash provided by operating activities", "cash from operating activities"]
  );
  const capex = findByConceptOrLabel(
    cf,
    ["us-gaap_PaymentsToAcquireProductiveAssets", "us-gaap_PaymentsToAcquirePropertyPlantAndEquipment"],
    ["purchases of property", "capital expenditures"]
  );
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
