import type { FinnhubNewsItem } from "./finnhub";

/**
 * Finnhub's /company-news endpoint tags every article's `related` field with the
 * queried symbol even when the article barely (or never) mentions it — aggregator
 * "stocks to watch" listicles are the worst offenders. Require the headline or
 * summary to actually name NVIDIA/NVDA before treating an article as relevant.
 */
export function isNvdaRelevant(item: FinnhubNewsItem): boolean {
  return /nvidia|nvda/i.test(`${item.headline} ${item.summary}`);
}

export function filterRelevantNews(items: FinnhubNewsItem[]): FinnhubNewsItem[] {
  return items.filter((n) => n.headline && n.summary && isNvdaRelevant(n));
}
