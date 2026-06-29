import type { ProductionAlert, ProductionNotificationRecord } from "./production-types";

const notifications = new Map<string, ProductionNotificationRecord[]>();

export function upsertProductionNotifications(
  storeId: string,
  alerts: ProductionAlert[],
): ProductionNotificationRecord[] {
  const existing = notifications.get(storeId) ?? [];
  const merged = [...existing];

  for (const alert of alerts) {
    const index = merged.findIndex((item) => item.id === alert.id);
    if (index >= 0) {
      merged[index] = { ...merged[index], ...alert, read: merged[index].read };
      continue;
    }
    merged.unshift({ ...alert, read: false });
  }

  const trimmed = merged.slice(0, 100);
  notifications.set(storeId, trimmed);
  return trimmed;
}

export function listProductionNotifications(storeId: string): ProductionNotificationRecord[] {
  return [...(notifications.get(storeId) ?? [])];
}

export function dismissProductionNotification(storeId: string, alertId: string): void {
  const items = notifications.get(storeId) ?? [];
  notifications.set(
    storeId,
    items.map((item) => (item.id === alertId ? { ...item, dismissed: true, read: true } : item)),
  );
}

export function resolveProductionNotification(storeId: string, alertId: string): void {
  const items = notifications.get(storeId) ?? [];
  notifications.set(
    storeId,
    items.map((item) =>
      item.id === alertId ? { ...item, resolved: true, dismissed: false, read: true } : item,
    ),
  );
}

export function clearProductionNotifications(storeId?: string): void {
  if (storeId) {
    notifications.delete(storeId);
    return;
  }
  notifications.clear();
}
