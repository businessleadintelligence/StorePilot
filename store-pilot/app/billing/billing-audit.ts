import type { BillingAuditEvent, BillingDashboardData } from "./billing-types";

const auditLog = new Map<string, BillingAuditEvent[]>();

export function appendBillingAuditEvent(input: {
  storeId: string;
  eventType: string;
  message: string;
}): BillingAuditEvent {
  const event: BillingAuditEvent = {
    id: `audit:${input.storeId}:${Date.now()}:${input.eventType}`,
    storeId: input.storeId,
    eventType: input.eventType,
    message: input.message,
    createdAt: new Date().toISOString(),
  };

  const entries = auditLog.get(input.storeId) ?? [];
  entries.unshift(event);
  auditLog.set(input.storeId, entries.slice(0, 100));
  return event;
}

export function listBillingAuditEvents(storeId: string, limit = 20): BillingAuditEvent[] {
  return [...(auditLog.get(storeId) ?? [])].slice(0, limit);
}

export function clearBillingAudit(storeId?: string): void {
  if (storeId) {
    auditLog.delete(storeId);
    return;
  }
  auditLog.clear();
}

export function recordBillingLifecycleEvent(
  storeId: string,
  eventType: string,
  message: string,
): void {
  appendBillingAuditEvent({ storeId, eventType, message });
}

export function validateBillingDashboardForMerchant(dashboard: BillingDashboardData): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const serialized = JSON.stringify(dashboard);

  if (/charge[_-]?id|payment[_-]?token|shopifySubscriptionGid/i.test(serialized)) {
    errors.push("dashboard exposes internal billing identifiers");
  }

  if (dashboard.currentPlan.monthlyPriceUsd <= 0 && dashboard.commercialStatus === "active") {
    errors.push("active plan must have positive pricing");
  }

  return { ok: errors.length === 0, errors };
}
