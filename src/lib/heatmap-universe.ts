/**
 * The market heatmap is deliberately a fixed, curated board rather than a screener.
 * The sector map is the primary view: each sector is represented by its iShares U.S.
 * sector ETF, and its area is the sector's approximate weight in the Russell 1000.
 * The stock list below is a secondary drill-down, not a claim to represent the whole market.
 *
 * The map follows ICB (FTSE Russell), the classification used by the Russell 1000 and
 * the iShares U.S. sector ETFs. ICB differs from GICS in ways that matter here: Alphabet
 * and Meta are Technology (Consumer Digital Services), media/entertainment such as
 * Netflix and Disney is Consumer Discretionary, communications equipment such as Cisco
 * and Arista is Telecommunications, and payment processors such as Visa and Mastercard
 * are Industrials. There is no Communication Services industry in ICB.
 *
 * Sector assignment and market weights are classification metadata (they change rarely),
 * not live measurements. Live prices and ETF changes always come from the providers.
 */
export const HEATMAP_SECTORS = [
  {
    id: "technology",
    label: "เทคโนโลยี",
    shortLabel: "เทคโนโลยี",
    etf: "IYW",
    /** Approximate Russell 1000 ICB weight, percent. Sums to 100.0. */
    marketWeight: 42.5,
  },
  {
    id: "telecommunications",
    label: "โทรคมนาคม",
    shortLabel: "โทรคมนาคม",
    etf: "IYZ",
    marketWeight: 2.3,
  },
  {
    id: "consumer-discretionary",
    label: "สินค้าฟุ่มเฟือย",
    shortLabel: "ฟุ่มเฟือย",
    etf: "IYC",
    marketWeight: 12.0,
  },
  {
    id: "consumer-staples",
    label: "สินค้าจำเป็น",
    shortLabel: "สินค้าจำเป็น",
    etf: "IYK",
    marketWeight: 3.4,
  },
  {
    id: "health-care",
    label: "สุขภาพ",
    shortLabel: "สุขภาพ",
    etf: "IYH",
    marketWeight: 9.3,
  },
  {
    id: "financials",
    label: "การเงิน",
    shortLabel: "การเงิน",
    etf: "IYF",
    marketWeight: 9.7,
  },
  {
    id: "industrials",
    label: "อุตสาหกรรม",
    shortLabel: "อุตสาหกรรม",
    etf: "IYJ",
    marketWeight: 11.4,
  },
  {
    id: "energy",
    label: "พลังงาน",
    shortLabel: "พลังงาน",
    etf: "IYE",
    marketWeight: 3.7,
  },
  {
    id: "utilities",
    label: "สาธารณูปโภค",
    shortLabel: "ยูทิลิตี้",
    etf: "IDU",
    marketWeight: 2.1,
  },
  {
    id: "real-estate",
    label: "อสังหาริมทรัพย์",
    shortLabel: "อสังหาฯ",
    etf: "IYR",
    marketWeight: 2.0,
  },
  {
    id: "materials",
    label: "วัสดุพื้นฐาน",
    shortLabel: "วัสดุ",
    etf: "IYM",
    marketWeight: 1.6,
  },
] as const;

/** Weights are a snapshot, not a live index feed; refresh this label with the table.
 *  They are rounded from the latest available FTSE Russell sector-index factsheets
 *  (2026) and normalized to 100.0; real estate and utilities are held at approximate
 *  Russell 1000 weights. */
export const SECTOR_WEIGHT_AS_OF = "ก.ย. 2026";

export type HeatmapSectorId = (typeof HEATMAP_SECTORS)[number]["id"];

export interface HeatmapUniverseEntry {
  symbol: string;
  /** Fallback display name if both provider responses omit a company name. */
  name: string;
  sector: HeatmapSectorId;
}

export const HEATMAP_UNIVERSE: HeatmapUniverseEntry[] = [
  { symbol: "AAPL", name: "Apple", sector: "technology" },
  { symbol: "MSFT", name: "Microsoft", sector: "technology" },
  { symbol: "NVDA", name: "NVIDIA", sector: "technology" },
  { symbol: "AVGO", name: "Broadcom", sector: "technology" },
  { symbol: "GOOGL", name: "Alphabet", sector: "technology" },
  { symbol: "META", name: "Meta Platforms", sector: "technology" },

  { symbol: "VZ", name: "Verizon", sector: "telecommunications" },
  { symbol: "T", name: "AT&T", sector: "telecommunications" },
  { symbol: "CSCO", name: "Cisco", sector: "telecommunications" },

  { symbol: "AMZN", name: "Amazon", sector: "consumer-discretionary" },
  { symbol: "TSLA", name: "Tesla", sector: "consumer-discretionary" },
  { symbol: "NFLX", name: "Netflix", sector: "consumer-discretionary" },
  { symbol: "WMT", name: "Walmart", sector: "consumer-discretionary" },

  { symbol: "PG", name: "Procter & Gamble", sector: "consumer-staples" },
  { symbol: "KO", name: "Coca-Cola", sector: "consumer-staples" },
  { symbol: "PEP", name: "PepsiCo", sector: "consumer-staples" },

  { symbol: "LLY", name: "Eli Lilly", sector: "health-care" },
  { symbol: "UNH", name: "UnitedHealth", sector: "health-care" },
  { symbol: "JNJ", name: "Johnson & Johnson", sector: "health-care" },

  { symbol: "JPM", name: "JPMorgan Chase", sector: "financials" },
  { symbol: "BAC", name: "Bank of America", sector: "financials" },
  { symbol: "GS", name: "Goldman Sachs", sector: "financials" },

  { symbol: "GE", name: "GE Aerospace", sector: "industrials" },
  { symbol: "CAT", name: "Caterpillar", sector: "industrials" },
  { symbol: "V", name: "Visa", sector: "industrials" },
  { symbol: "MA", name: "Mastercard", sector: "industrials" },

  { symbol: "XOM", name: "Exxon Mobil", sector: "energy" },
  { symbol: "CVX", name: "Chevron", sector: "energy" },
  { symbol: "COP", name: "ConocoPhillips", sector: "energy" },

  { symbol: "NEE", name: "NextEra Energy", sector: "utilities" },
  { symbol: "DUK", name: "Duke Energy", sector: "utilities" },

  { symbol: "AMT", name: "American Tower", sector: "real-estate" },
  { symbol: "PLD", name: "Prologis", sector: "real-estate" },

  { symbol: "LIN", name: "Linde", sector: "materials" },
  { symbol: "FCX", name: "Freeport-McMoRan", sector: "materials" },
  { symbol: "NEM", name: "Newmont", sector: "materials" },
];

const SECTOR_LABELS = new Map<string, string>(
  HEATMAP_SECTORS.map((sector) => [sector.id, sector.label])
);

const SECTOR_SHORT_LABELS = new Map<string, string>(
  HEATMAP_SECTORS.map((sector) => [sector.id, sector.shortLabel])
);

export function sectorLabel(id: string): string {
  return SECTOR_LABELS.get(id) ?? id;
}

/** Header-sized label for tight treemap blocks; the full name stays in aria labels. */
export function sectorShortLabel(id: string): string {
  return SECTOR_SHORT_LABELS.get(id) ?? sectorLabel(id);
}
