import { createClient, type Client } from "@libsql/client";

declare global {
  var __nvdaTurso: Client | undefined;
  var __nvdaTursoInitialized: boolean | undefined;
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
 */
export async function getDb(): Promise<Client> {
  if (!globalThis.__nvdaTurso) {
    globalThis.__nvdaTurso = createTursoClient();
  }
  if (!globalThis.__nvdaTursoInitialized) {
    await globalThis.__nvdaTurso.execute(`
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
    await globalThis.__nvdaTurso.execute(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        alertId TEXT NOT NULL,
        message TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        readAt INTEGER
      )
    `);
    globalThis.__nvdaTursoInitialized = true;
  }
  return globalThis.__nvdaTurso;
}
