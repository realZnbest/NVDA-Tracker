import type { FinnhubNewsItem } from "./finnhub";

/**
 * Finnhub's /company-news endpoint tags every article's `related` field with the
 * queried symbol even when the article barely (or never) mentions it — aggregator
 * "stocks to watch" listicles are the worst offenders. Require the headline or
 * summary to actually name the company (by ticker or by a word from its registered
 * name) before treating an article as relevant.
 */

const LEGAL_WORDS = new Set([
  "inc",
  "incorporated",
  "corp",
  "corporation",
  "co",
  "company",
  "ltd",
  "limited",
  "plc",
  "holdings",
  "holding",
  "group",
  "the",
  "and",
  "of",
  "class",
  "common",
  "stock",
  "adr",
  "adrs",
  "sa",
  "ag",
  "nv",
  "se",
]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-word match, so "apple" doesn't match "pineapple" and "KO" doesn't match random text. */
function wordPattern(word: string): RegExp {
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(word)}([^a-z0-9]|$)`, "i");
}

function companyNameWords(companyName: string): string[] {
  return companyName
    .toLowerCase()
    .replace(/&/g, " and ")
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3 && !LEGAL_WORDS.has(word));
}

export function isSymbolRelevant(
  item: FinnhubNewsItem,
  symbol: string,
  companyName?: string | null
): boolean {
  const text = `${item.headline} ${item.summary}`;
  if (wordPattern(symbol).test(text)) return true;
  if (!companyName) return false;
  return companyNameWords(companyName).some((word) => wordPattern(word).test(text));
}

export function filterRelevantNews(
  items: FinnhubNewsItem[],
  symbol: string,
  companyName?: string | null
): FinnhubNewsItem[] {
  const withText = items.filter((n) => n.headline && n.summary);
  // Without a company name we can't judge relevance at all — showing the raw feed is
  // better than hiding every article (the old behavior for any non-NVDA symbol).
  if (!companyName) return withText;

  const relevant = withText.filter((n) => isSymbolRelevant(n, symbol, companyName));
  // A miss usually means the profile name and the article's wording differ; don't turn
  // that into an empty news page when Finnhub did return articles for the symbol.
  return relevant.length > 0 ? relevant : withText;
}
