import type { FinnhubReportedFinancials } from "./finnhub";

const EDGAR_BASE = "https://data.sec.gov";
const EDGAR_HEADERS: HeadersInit = {
  // SEC EDGAR's WAF blocks non-browser User-Agent strings from residential IPs.
  // A stock browser UA (with Accept-Language) is what their filter lets through.
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json",
  "Accept-Language": "en-US,en;q=0.9",
};

const XBRL_CONCEPTS = {
  ic: [
    "us-gaap/Revenues",
    "us-gaap/RevenueFromContractWithCustomerExcludingAssessedTax",
    "us-gaap/SalesRevenueNet",
    "us-gaap/NetIncomeLoss",
    "us-gaap/EarningsPerShareDiluted",
    "us-gaap/EarningsPerShareBasic",
    "us-gaap/GrossProfit",
    "us-gaap/OperatingIncomeLoss",
  ],
  bs: [
    "us-gaap/LongTermDebtNoncurrent",
    "us-gaap/LongTermDebt",
    "us-gaap/DebtCurrent",
    "us-gaap/ShortTermBorrowings",
    "us-gaap/LongTermDebtCurrent",
  ],
  cf: [
    "us-gaap/NetCashProvidedByUsedInOperatingActivities",
    "us-gaap/PaymentsToAcquireProductiveAssets",
    "us-gaap/PaymentsToAcquirePropertyPlantAndEquipment",
  ],
};

interface EdgarEntry {
  form: string;
  filed: string;
  start?: string;
  end: string;
  val: number;
  frame?: string;
}

interface EdgarConceptResponse {
  cik: string;
  entityName: string;
  units: Record<string, EdgarEntry[]>;
}

interface QuarterlyValue {
  concept: string;
  label: string;
  unit: string;
  value: number;
}

const cikCache = new Map<string, string>();
const dataCache = new Map<
  string,
  { expires: number; data: FinnhubReportedFinancials }
>();

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: EDGAR_HEADERS, cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function lookupCIK(symbol: string): Promise<string | null> {
  const cached = cikCache.get(symbol);
  if (cached) return cached;

  const data = await fetchJson<
    Record<string, { cik_str: number; ticker: string }>
  >("https://www.sec.gov/files/company_tickers.json");
  if (!data) return null;

  for (const entry of Object.values(data)) {
    if (entry.ticker === symbol) {
      const cikStr = String(entry.cik_str);
      cikCache.set(symbol, cikStr);
      return cikStr;
    }
  }
  return null;
}

function toFinhubConcept(concept: string): string {
  return concept.replace("/", "_");
}

// Cash-flow concepts (OCF, capex, ...) are reported on 10-Q/10-K as cumulative
// year-to-date durations (start = fiscal-year start). The cyclic "Q" frame tag only
// exists on every quarter, so we convert YTD values into quarterly deltas by
// subtracting the previous same-fiscal-year period.
function computeCfQuarterly(entries: EdgarEntry[]): EdgarEntry[] {
  const valid = entries
    .filter((e) => e.form === "10-Q" || e.form === "10-K")
    .sort((a, b) => new Date(b.filed).getTime() - new Date(a.filed).getTime());

  const byEnd = new Map<string, EdgarEntry>();
  for (const e of valid) byEnd.set(e.end, e);

  const byStart = new Map<string, EdgarEntry[]>();
  for (const e of byEnd.values()) {
    const key = e.start ?? e.end;
    const arr = byStart.get(key) ?? [];
    arr.push(e);
    byStart.set(key, arr);
  }

  const out: EdgarEntry[] = [];
  for (const arr of byStart.values()) {
    const sorted = arr.sort(
      (a, b) => new Date(a.end).getTime() - new Date(b.end).getTime()
    );
    let prev: EdgarEntry | null = null;
    for (const e of sorted) {
      out.push({
        ...e,
        val: prev && e.start === prev.start ? e.val - prev.val : e.val,
      });
      prev = e;
    }
  }
  return out;
}

function pickLatest(
  entries: EdgarEntry[],
  quarterEnd: string
): EdgarEntry | null {
  const matches = entries.filter(
    (e) =>
      e.end === quarterEnd && (e.form === "10-Q" || e.form === "10-K")
  );
  if (matches.length === 0) return null;
  return matches.sort(
    (a, b) => new Date(b.filed).getTime() - new Date(a.filed).getTime()
  )[0];
}

export async function getReportedFinancialsFromEdgar(
  symbol: string
): Promise<FinnhubReportedFinancials | null> {
  const cacheKey = `edgar:${symbol}`;
  const cached = dataCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.data;

  const cik = await lookupCIK(symbol);
  if (!cik) return null;

  const paddedCik = cik.padStart(10, "0");
  const allConcepts = [
    ...XBRL_CONCEPTS.ic,
    ...XBRL_CONCEPTS.bs,
    ...XBRL_CONCEPTS.cf,
  ];

  const results = await Promise.all(
    allConcepts.map(async (concept) => {
      const [taxonomy, conceptName] = concept.split("/");
      const url = `${EDGAR_BASE}/api/xbrl/companyconcept/CIK${paddedCik}/${taxonomy}/${conceptName}.json`;
      const data = await fetchJson<EdgarConceptResponse>(url);
      return { concept, data };
    })
  );

  const quarterEnds = new Set<string>();
  const quarterValues = new Map<string, Map<string, QuarterlyValue>>();

  for (const { concept, data } of results) {
    if (!data?.units) continue;
    const finhubConcept = toFinhubConcept(concept);
    const allEntries: EdgarEntry[] = Object.entries(data.units)
      .flatMap(([unit, list]) => list.map((e) => ({ ...e, unit } as EdgarEntry & { unit: string })));

    const source = XBRL_CONCEPTS.cf.includes(concept)
      ? computeCfQuarterly(allEntries)
      : allEntries.filter(
          (e) =>
            (e.form === "10-Q" || e.form === "10-K") &&
            e.frame &&
            e.frame.includes("Q")
        );

    const byEnd = new Map<string, EdgarEntry[]>();
    for (const entry of source) {
      const arr = byEnd.get(entry.end) ?? [];
      arr.push(entry);
      byEnd.set(entry.end, arr);
    }

    for (const [endDate, entries] of byEnd) {
      const latest = pickLatest(entries, endDate);
      if (!latest) continue;
      quarterEnds.add(endDate);

      if (!quarterValues.has(endDate)) {
        quarterValues.set(endDate, new Map());
      }
      const map = quarterValues.get(endDate)!;
      if (!map.has(finhubConcept)) {
        map.set(finhubConcept, {
          concept: finhubConcept,
          label: concept.split("/").pop()!,
          unit: (latest as EdgarEntry & { unit?: string })?.unit ?? "USD",
          value: latest.val,
        });
      }
    }
  }

  const icSet = new Set(XBRL_CONCEPTS.ic.map(toFinhubConcept));
  const bsSet = new Set(XBRL_CONCEPTS.bs.map(toFinhubConcept));
  const cfSet = new Set(XBRL_CONCEPTS.cf.map(toFinhubConcept));

  const data = Array.from(quarterEnds)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
    .map((endDate) => {
      const vals = quarterValues.get(endDate)!;
      const items = Array.from(vals.values());
      const sample = items[0];
      const form = (() => {
        const sourceData = sample?.concept
          ? results.find((r) => toFinhubConcept(r.concept) === sample.concept)
              ?.data
          : undefined;
        if (sourceData?.units) {
          const matched = Object.values(sourceData.units)
            .flat()
            .find((e) => e.end === endDate);
          if (matched) return matched.form;
        }
        return "10-Q";
      })();

      return {
        year: 0,
        quarter: 0,
        form,
        startDate: "",
        endDate,
        report: {
          bs: items.filter((v) => bsSet.has(v.concept)),
          ic: items.filter((v) => icSet.has(v.concept)),
          cf: items.filter((v) => cfSet.has(v.concept)),
        },
      };
    })
    // Drop rows sourced purely from the annual 10-K: their income-statement (ic)
    // items are yearly totals without a "Q" frame, so they'd render as empty bars.
    // The 10-Q remains the only quarter-level source going forward.
    .filter((e) => e.form !== "10-K");

  if (data.length === 0) return null;

  const result: FinnhubReportedFinancials = { data };
  dataCache.set(cacheKey, { expires: Date.now() + 60 * 60_000, data: result });
  return result;
}

export function assignFiscalQuarters(
  finhub: FinnhubReportedFinancials,
  edgar: FinnhubReportedFinancials
): void {
  const norm = (d: string) => String(d).slice(0, 10);
  const millis = (d: string) => new Date(norm(d)).getTime();
  const MONTH_MS = 30.44 * 24 * 60 * 60 * 1000;

  // Only Finnhub's labeled quarters are trusted anchors — previously assigned EDGAR
  // entries must never be used as anchor history (it compounds a +1-quarter drift).
  const anchors = finhub.data
    .filter((e) => e.year && e.quarter)
    .map((e) => ({ end: norm(e.endDate), year: e.year, quarter: e.quarter }))
    .sort((a, b) => millis(a.end) - millis(b.end));

  const pending = edgar.data
    .filter((e) => !(e.year && e.quarter))
    .sort((a, b) => millis(a.endDate) - millis(b.endDate));

  for (const entry of pending) {
    const endDate = norm(entry.endDate);
    const endMs = millis(endDate);

    const exact = anchors.find((a) => a.end === endDate);
    if (exact) {
      entry.year = exact.year;
      entry.quarter = exact.quarter;
      continue;
    }

    const before = anchors.filter((a) => millis(a.end) < endMs);
    if (before.length > 0) {
      const last = before[before.length - 1];
      const monthsDiff = (endMs - millis(last.end)) / MONTH_MS;
      if (monthsDiff > -1 && monthsDiff <= 5.5) {
        const quarterSequence = last.year * 4 + (last.quarter - 1) + Math.round(monthsDiff / 3);
        entry.year = Math.floor(quarterSequence / 4);
        entry.quarter = (quarterSequence % 4) + 1;
        if (entry.quarter <= 0) {
          entry.quarter += 4;
          entry.year -= 1;
        }
        continue;
      }
    }

    const d = new Date(endDate);
    const month = d.getMonth();
    if (month >= 0 && month <= 2) {
      entry.quarter = 4;
      entry.year = d.getFullYear() - 1;
    } else if (month >= 3 && month <= 5) {
      entry.quarter = 1;
      entry.year = d.getFullYear();
    } else if (month >= 6 && month <= 8) {
      entry.quarter = 2;
      entry.year = d.getFullYear();
    } else {
      entry.quarter = 3;
      entry.year = d.getFullYear();
    }
  }
}
