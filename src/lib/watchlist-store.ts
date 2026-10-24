import { getDb } from "./db";
import {
  MAX_WATCHLIST_ITEMS,
  WATCHLIST_SYMBOL_PATTERN,
  type WatchlistItem,
} from "./types";

interface WatchlistRow {
  symbol: string;
  name: string;
  sortOrder: number;
  createdAt: number;
}

export class WatchlistError extends Error {
  code: "INVALID_SYMBOL" | "WATCHLIST_FULL";

  constructor(code: "INVALID_SYMBOL" | "WATCHLIST_FULL") {
    super(code);
    this.code = code;
  }
}

function rowToItem(row: WatchlistRow): WatchlistItem {
  return {
    symbol: row.symbol,
    name: row.name,
    sortOrder: Number(row.sortOrder),
    createdAt: Number(row.createdAt),
  };
}

export function normalizeWatchlistSymbol(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isValidWatchlistSymbol(symbol: string): boolean {
  return WATCHLIST_SYMBOL_PATTERN.test(symbol);
}

/**
 * The list, quotes and market routes each read it on every poll, and every read is a
 * network round trip to Turso. A few seconds of in-process cache collapses a page load's
 * three reads into one; writes in this process clear it, and the short TTL bounds how
 * long a write made on another serverless instance can stay invisible.
 */
const LIST_CACHE_TTL_MS = 5_000;
let listCache: { expires: number; items: WatchlistItem[] } | null = null;

/** Ordered exactly how the owner arranged the list; newest additions fall to the end. */
export async function listWatchlist(): Promise<WatchlistItem[]> {
  if (listCache && listCache.expires > Date.now()) return listCache.items;
  const db = await getDb();
  const result = await db.execute(
    `SELECT symbol, name, sortOrder, createdAt
       FROM watchlist_items
      ORDER BY sortOrder ASC, createdAt ASC`
  );
  const items = (result.rows as unknown as WatchlistRow[]).map(rowToItem);
  listCache = { expires: Date.now() + LIST_CACHE_TTL_MS, items };
  return items;
}

/**
 * Idempotent add: re-selecting a symbol already on the list just refreshes its display
 * name instead of creating a duplicate row or moving it. The owner's ordering is theirs.
 */
export async function addWatchlistItem(input: {
  symbol: string;
  name?: string;
}): Promise<WatchlistItem> {
  const symbol = normalizeWatchlistSymbol(input.symbol);
  if (!isValidWatchlistSymbol(symbol)) throw new WatchlistError("INVALID_SYMBOL");

  listCache = null;
  const db = await getDb();
  const existing = await db.execute({
    sql: `SELECT symbol, name, sortOrder, createdAt FROM watchlist_items WHERE symbol = ?`,
    args: [symbol],
  });
  if (existing.rows.length > 0) {
    const row = existing.rows[0] as unknown as WatchlistRow;
    const name = input.name?.trim().slice(0, 200);
    if (name && name !== row.name) {
      await db.execute({
        sql: `UPDATE watchlist_items SET name = ? WHERE symbol = ?`,
        args: [name, symbol],
      });
      row.name = name;
    }
    return rowToItem(row);
  }

  const countResult = await db.execute(`SELECT COUNT(*) AS count FROM watchlist_items`);
  const count = Number((countResult.rows[0] as unknown as { count: number | bigint }).count ?? 0);
  if (count >= MAX_WATCHLIST_ITEMS) throw new WatchlistError("WATCHLIST_FULL");

  const maxResult = await db.execute(
    `SELECT COALESCE(MAX(sortOrder), -1) AS maxOrder FROM watchlist_items`
  );
  const maxOrder = Number(
    (maxResult.rows[0] as unknown as { maxOrder: number | bigint }).maxOrder ?? -1
  );

  const item: WatchlistItem = {
    symbol,
    name: input.name?.trim().slice(0, 200) ?? "",
    sortOrder: maxOrder + 1,
    createdAt: Date.now(),
  };
  await db.execute({
    sql: `INSERT INTO watchlist_items (symbol, name, sortOrder, createdAt)
          VALUES (?, ?, ?, ?)`,
    args: [item.symbol, item.name, item.sortOrder, item.createdAt],
  });
  listCache = null;
  return item;
}

export async function deleteWatchlistItem(symbol: string): Promise<void> {
  const normalized = normalizeWatchlistSymbol(symbol);
  if (!isValidWatchlistSymbol(normalized)) return;
  listCache = null;
  const db = await getDb();
  await db.execute({
    sql: `DELETE FROM watchlist_items WHERE symbol = ?`,
    args: [normalized],
  });
  listCache = null;
}

/**
 * Rewrites the full order. Symbols not currently on the list are ignored rather than
 * trusted from the client, and the caller sends every symbol it rendered — a partial
 * order would otherwise shuffle the remainder unpredictably.
 */
export async function reorderWatchlist(symbols: string[]): Promise<WatchlistItem[]> {
  listCache = null;
  const db = await getDb();
  const existing = await listWatchlist();
  const existingSymbols = new Set(existing.map((item) => item.symbol));
  const requested = symbols
    .map(normalizeWatchlistSymbol)
    .filter(
      (symbol, index, all) =>
        isValidWatchlistSymbol(symbol) &&
        existingSymbols.has(symbol) &&
        all.indexOf(symbol) === index
    )
    .slice(0, MAX_WATCHLIST_ITEMS);

  // Any row the client didn't mention keeps its relative order after the requested ones.
  // A partial reorder therefore can't leave two rows sharing an old sortOrder.
  const ordered = [
    ...requested,
    ...existing
      .map((item) => item.symbol)
      .filter((symbol) => !requested.includes(symbol)),
  ];

  // One round trip (and one transaction) instead of a sequential UPDATE per row.
  await db.batch(
    ordered.map((symbol, i) => ({
      sql: `UPDATE watchlist_items SET sortOrder = ? WHERE symbol = ?`,
      args: [i, symbol],
    })),
    "write"
  );
  listCache = null;
  return listWatchlist();
}
