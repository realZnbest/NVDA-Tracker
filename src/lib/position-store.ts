import { db } from "./db";
import type { Position } from "./position";

interface PositionRow extends Position {
  id: number;
}

export function getPosition(): Position | null {
  const row = db.prepare(`SELECT * FROM position WHERE id = 1`).get() as PositionRow | undefined;
  if (!row) return null;
  return { avgCost: row.avgCost, shares: row.shares, startDate: row.startDate, updatedAt: row.updatedAt };
}

export function upsertPosition(input: { avgCost: number; shares: number; startDate: number }): Position {
  const updatedAt = Date.now();
  db.prepare(
    `INSERT INTO position (id, avgCost, shares, startDate, updatedAt)
     VALUES (1, @avgCost, @shares, @startDate, @updatedAt)
     ON CONFLICT(id) DO UPDATE SET avgCost = @avgCost, shares = @shares, startDate = @startDate, updatedAt = @updatedAt`
  ).run({ ...input, updatedAt });
  return { ...input, updatedAt };
}

export function deletePosition(): void {
  db.prepare(`DELETE FROM position WHERE id = 1`).run();
}
