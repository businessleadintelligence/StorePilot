import type { BillingAuditEvent } from "./billing-types";

const historyStore = new Map<string, BillingAuditEvent[]>();

export function appendBillingHistoryEvent(event: BillingAuditEvent): void {
  const entries = historyStore.get(event.storeId) ?? [];
  entries.unshift(event);
  historyStore.set(event.storeId, entries.slice(0, 50));
}

export function listBillingHistory(storeId: string, limit = 10): BillingAuditEvent[] {
  return (historyStore.get(storeId) ?? []).slice(0, limit);
}

export function clearBillingHistory(storeId?: string): void {
  if (storeId) {
    historyStore.delete(storeId);
    return;
  }
  historyStore.clear();
}
