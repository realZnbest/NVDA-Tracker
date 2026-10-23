import { createClient, type Client } from "@libsql/client";

declare global {
  var __nvdaTurso: Client | undefined;
  var __nvdaTursoInitialized: boolean | undefined;
  var __nvdaTursoSchemaVersion: number | undefined;
  var __nvdaTursoInitPromise: Promise<void> | undefined;
}

/** Bump when adding a table/column so a long-lived dev process re-runs the idempotent
 *  schema setup after hot reload instead of assuming its old globals are still current. */
const SCHEMA_VERSION = 1;

/**
 * libSQL has no `ADD COLUMN IF NOT EXISTS` — check `PRAGMA table_info` first so re-running
 * this on a DB that already has the column (every deploy after the first) is a no-op
 * instead of an error.
 */
async function addColumnIfMissing(
  db: Client,
  table: string,
  column: string,
  definition: string
): Promise<void> {
  const info = await db.execute(`PRAGMA table_info(${table})`);
  const exists = info.rows.some((row) => (row as unknown as { name: string }).name === column);
  if (!exists) {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function createTursoClient(): Client {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) {
    throw new Error("MISSING_TURSO_CONFIG");
  }
  return createClient({ url, authToken });
}

/**
 * Lazily constructed on first real use, not at module load — Next.js evaluates route
 * modules while collecting page data at build time, which would otherwise throw for
 * missing env vars even on a machine that never actually serves a request. Tables are
 * created here too (idempotent `CREATE TABLE IF NOT EXISTS`) so there's no separate
 * manual migration step — unlike a hosted Postgres, a fresh Turso database starts empty.
 *
 * Initialization is guarded by a shared promise: the first alert check calls listAlerts()
 * and listLots() concurrently, and without this both would run the CREATE/ALTER sequence
 * at once on a cold process and one of them would fail.
 */
export async function getDb(): Promise<Client> {
  const db =
    globalThis.__nvdaTurso ??
    (globalThis.__nvdaTurso = createTursoClient());

  if (
    !globalThis.__nvdaTursoInitialized ||
    globalThis.__nvdaTursoSchemaVersion !== SCHEMA_VERSION
  ) {
    if (!globalThis.__nvdaTursoInitPromise) {
      globalThis.__nvdaTursoInitPromise = initializeDatabase(db).finally(() => {
        globalThis.__nvdaTursoInitPromise = undefined;
      });
    }
    await globalThis.__nvdaTursoInitPromise;
  }
  return db;
}

async function initializeDatabase(db: Client): Promise<void> {
  await db.execute(`
      CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        label TEXT NOT NULL,
        threshold REAL,
        fastPeriod INTEGER,
        slowPeriod INTEGER,
        active INTEGER NOT NULL DEFAULT 1,
        createdAt INTEGER NOT NULL,
        lastTriggeredAt INTEGER
      )
    `);
  await db.execute(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        alertId TEXT NOT NULL,
        message TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        readAt INTEGER
      )
    `);
  await db.execute(`
      CREATE TABLE IF NOT EXISTS watchlist_items (
        symbol TEXT PRIMARY KEY,
        name TEXT NOT NULL DEFAULT '',
        sortOrder INTEGER NOT NULL DEFAULT 0,
        createdAt INTEGER NOT NULL
      )
    `);
  await db.execute(`
      CREATE TABLE IF NOT EXISTS position_lots (
        id TEXT PRIMARY KEY,
        purchaseDate INTEGER NOT NULL,
        shares REAL NOT NULL,
        pricePerShare REAL NOT NULL,
        createdAt INTEGER NOT NULL
      )
    `);
  await addColumnIfMissing(db, "position_lots", "symbol", "TEXT NOT NULL DEFAULT 'NVDA'");
  await addColumnIfMissing(db, "alerts", "symbol", "TEXT");
  // Backfill pre-migration alerts: everything used to implicitly mean NVDA, including
  // pnl_percent_* — those become portfolio-wide only when the owner explicitly creates
  // a new portfolio_pnl_percent_* alert, so existing rows keep their old (NVDA) meaning.
  await db.execute(
    `UPDATE alerts SET symbol = 'NVDA' WHERE symbol IS NULL AND type != 'portfolio_pnl_percent_above' AND type != 'portfolio_pnl_percent_below'`
  );
  globalThis.__nvdaTursoSchemaVersion = SCHEMA_VERSION;
  globalThis.__nvdaTursoInitialized = true;
}
