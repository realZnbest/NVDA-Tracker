import { randomUUID } from "node:crypto";
import { getDb } from "./db";
import type { Alert, AlertNotification, AlertType } from "./types";

interface AlertRow {
  id: string;
  type: AlertType;
  label: string;
  threshold: number | null;
  fastPeriod: number | null;
  slowPeriod: number | null;
  active: number;
  createdAt: number;
  lastTriggeredAt: number | null;
}

function rowToAlert(row: AlertRow): Alert {
  return { ...row, active: row.active === 1 };
}

export async function listAlerts(): Promise<Alert[]> {
  const db = await getDb();
  const result = await db.execute(`SELECT * FROM alerts ORDER BY createdAt DESC`);
  return (result.rows as unknown as AlertRow[]).map(rowToAlert);
}

export async function createAlert(input: {
  type: AlertType;
  label: string;
  threshold?: number | null;
  fastPeriod?: number | null;
  slowPeriod?: number | null;
}): Promise<Alert> {
  const db = await getDb();
  const row: AlertRow = {
    id: randomUUID(),
    type: input.type,
    label: input.label,
    threshold: input.threshold ?? null,
    fastPeriod: input.fastPeriod ?? null,
    slowPeriod: input.slowPeriod ?? null,
    active: 1,
    createdAt: Date.now(),
    lastTriggeredAt: null,
  };
  await db.execute({
    sql: `INSERT INTO alerts (id, type, label, threshold, fastPeriod, slowPeriod, active, createdAt, lastTriggeredAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      row.id,
      row.type,
      row.label,
      row.threshold,
      row.fastPeriod,
      row.slowPeriod,
      row.active,
      row.createdAt,
      row.lastTriggeredAt,
    ],
  });
  return rowToAlert(row);
}

export async function updateAlert(
  id: string,
  input: Partial<{ label: string; threshold: number | null; active: boolean }>
): Promise<Alert | null> {
  const db = await getDb();
  const existingResult = await db.execute({ sql: `SELECT * FROM alerts WHERE id = ?`, args: [id] });
  const existing = existingResult.rows[0] as unknown as AlertRow | undefined;
  if (!existing) return null;

  const next: AlertRow = {
    ...existing,
    label: input.label ?? existing.label,
    threshold: input.threshold !== undefined ? input.threshold : existing.threshold,
    active: input.active !== undefined ? (input.active ? 1 : 0) : existing.active,
  };
  await db.execute({
    sql: `UPDATE alerts SET label = ?, threshold = ?, active = ? WHERE id = ?`,
    args: [next.label, next.threshold, next.active, id],
  });
  return rowToAlert(next);
}

export async function deleteAlert(id: string): Promise<void> {
  const db = await getDb();
  await db.execute({ sql: `DELETE FROM alerts WHERE id = ?`, args: [id] });
  await db.execute({ sql: `DELETE FROM notifications WHERE alertId = ?`, args: [id] });
}

export async function markAlertTriggered(id: string): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: `UPDATE alerts SET lastTriggeredAt = ? WHERE id = ?`,
    args: [Date.now(), id],
  });
}

export async function addNotification(alertId: string, message: string): Promise<AlertNotification> {
  const db = await getDb();
  const note: AlertNotification = {
    id: randomUUID(),
    alertId,
    message,
    createdAt: Date.now(),
    readAt: null,
  };
  await db.execute({
    sql: `INSERT INTO notifications (id, alertId, message, createdAt, readAt) VALUES (?, ?, ?, ?, ?)`,
    args: [note.id, note.alertId, note.message, note.createdAt, note.readAt],
  });
  return note;
}

export async function listNotifications(limit = 30): Promise<AlertNotification[]> {
  const db = await getDb();
  const result = await db.execute({
    sql: `SELECT * FROM notifications ORDER BY createdAt DESC LIMIT ?`,
    args: [limit],
  });
  return result.rows as unknown as AlertNotification[];
}

export async function markNotificationsRead(): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: `UPDATE notifications SET readAt = ? WHERE readAt IS NULL`,
    args: [Date.now()],
  });
}
