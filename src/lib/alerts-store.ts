import { randomUUID } from "node:crypto";
import { db } from "./db";
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

export function listAlerts(): Alert[] {
  const rows = db
    .prepare(`SELECT * FROM alerts ORDER BY createdAt DESC`)
    .all() as AlertRow[];
  return rows.map(rowToAlert);
}

export function createAlert(input: {
  type: AlertType;
  label: string;
  threshold?: number | null;
  fastPeriod?: number | null;
  slowPeriod?: number | null;
}): Alert {
  const alert: AlertRow = {
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
  db.prepare(
    `INSERT INTO alerts (id, type, label, threshold, fastPeriod, slowPeriod, active, createdAt, lastTriggeredAt)
     VALUES (@id, @type, @label, @threshold, @fastPeriod, @slowPeriod, @active, @createdAt, @lastTriggeredAt)`
  ).run(alert);
  return rowToAlert(alert);
}

export function updateAlert(
  id: string,
  input: Partial<{ label: string; threshold: number | null; active: boolean }>
): Alert | null {
  const existing = db.prepare(`SELECT * FROM alerts WHERE id = ?`).get(id) as
    | AlertRow
    | undefined;
  if (!existing) return null;

  const next: AlertRow = {
    ...existing,
    label: input.label ?? existing.label,
    threshold: input.threshold !== undefined ? input.threshold : existing.threshold,
    active: input.active !== undefined ? (input.active ? 1 : 0) : existing.active,
  };
  db.prepare(
    `UPDATE alerts SET label = @label, threshold = @threshold, active = @active WHERE id = @id`
  ).run(next);
  return rowToAlert(next);
}

export function deleteAlert(id: string): void {
  db.prepare(`DELETE FROM alerts WHERE id = ?`).run(id);
  db.prepare(`DELETE FROM notifications WHERE alertId = ?`).run(id);
}

export function markAlertTriggered(id: string): void {
  db.prepare(`UPDATE alerts SET lastTriggeredAt = ? WHERE id = ?`).run(
    Date.now(),
    id
  );
}

export function addNotification(alertId: string, message: string): AlertNotification {
  const note: AlertNotification = {
    id: randomUUID(),
    alertId,
    message,
    createdAt: Date.now(),
    readAt: null,
  };
  db.prepare(
    `INSERT INTO notifications (id, alertId, message, createdAt, readAt)
     VALUES (@id, @alertId, @message, @createdAt, @readAt)`
  ).run(note);
  return note;
}

export function listNotifications(limit = 30): AlertNotification[] {
  return db
    .prepare(`SELECT * FROM notifications ORDER BY createdAt DESC LIMIT ?`)
    .all(limit) as AlertNotification[];
}

export function markNotificationsRead(): void {
  db.prepare(`UPDATE notifications SET readAt = ? WHERE readAt IS NULL`).run(
    Date.now()
  );
}
