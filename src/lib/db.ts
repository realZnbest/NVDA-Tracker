import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

declare global {
  var __nvdaDb: Database.Database | undefined;
}

function createDb() {
  const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, "alerts.db");
  const db = new Database(dbPath, { timeout: 5000 });
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");

  db.exec(`
    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      label TEXT NOT NULL,
      direction TEXT,
      threshold REAL,
      fastPeriod INTEGER,
      slowPeriod INTEGER,
      active INTEGER NOT NULL DEFAULT 1,
      createdAt INTEGER NOT NULL,
      lastTriggeredAt INTEGER
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      alertId TEXT NOT NULL,
      message TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      readAt INTEGER
    );
  `);

  return db;
}

export const db = globalThis.__nvdaDb ?? createDb();
if (process.env.NODE_ENV !== "production") {
  globalThis.__nvdaDb = db;
}
