import { randomUUID } from "node:crypto";
import { getDb } from "./db";
import type { PositionLot } from "./position";

export async function listLots(): Promise<PositionLot[]> {
  const db = await getDb();
  const result = await db.execute(`SELECT * FROM position_lots ORDER BY purchaseDate ASC`);
  return result.rows as unknown as PositionLot[];
}

export async function addLot(input: {
  purchaseDate: number;
  shares: number;
  pricePerShare: number;
}): Promise<PositionLot> {
  const db = await getDb();
  const lot: PositionLot = {
    id: randomUUID(),
    purchaseDate: input.purchaseDate,
    shares: input.shares,
    pricePerShare: input.pricePerShare,
    createdAt: Date.now(),
  };
  await db.execute({
    sql: `INSERT INTO position_lots (id, purchaseDate, shares, pricePerShare, createdAt)
          VALUES (?, ?, ?, ?, ?)`,
    args: [lot.id, lot.purchaseDate, lot.shares, lot.pricePerShare, lot.createdAt],
  });
  return lot;
}

export async function updateLot(
  id: string,
  input: Partial<{ purchaseDate: number; shares: number; pricePerShare: number }>
): Promise<PositionLot | null> {
  const db = await getDb();
  const existingResult = await db.execute({ sql: `SELECT * FROM position_lots WHERE id = ?`, args: [id] });
  const existing = existingResult.rows[0] as unknown as PositionLot | undefined;
  if (!existing) return null;

  const next: PositionLot = {
    ...existing,
    purchaseDate: input.purchaseDate ?? existing.purchaseDate,
    shares: input.shares ?? existing.shares,
    pricePerShare: input.pricePerShare ?? existing.pricePerShare,
  };
  await db.execute({
    sql: `UPDATE position_lots SET purchaseDate = ?, shares = ?, pricePerShare = ? WHERE id = ?`,
    args: [next.purchaseDate, next.shares, next.pricePerShare, id],
  });
  return next;
}

export async function deleteLot(id: string): Promise<void> {
  const db = await getDb();
  await db.execute({ sql: `DELETE FROM position_lots WHERE id = ?`, args: [id] });
}
