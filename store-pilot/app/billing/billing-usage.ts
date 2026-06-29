import { getCurrentUsageMonth } from "../services/billing.server";
import type { BillingAction, BillingUsageSnapshot } from "./billing-types";

const usageStore = new Map<string, BillingUsageSnapshot>();

function emptyUsage(storeId: string, month: string): BillingUsageSnapshot {
  return {
    storeId,
    month,
    aiExecutions: 0,
    automationExecutions: 0,
    connectorSyncs: 0,
    operationsCreated: 0,
    apiRequests: 0,
    backgroundJobs: 0,
    dataExports: 0,
    storageMb: 0,
  };
}

function usageKey(storeId: string, month: string): string {
  return `${storeId}:${month}`;
}

export async function getBillingUsageSnapshot(
  storeId: string,
  month = getCurrentUsageMonth(),
): Promise<BillingUsageSnapshot> {
  const key = usageKey(storeId, month);
  return structuredClone(usageStore.get(key) ?? emptyUsage(storeId, month));
}

export async function incrementBillingUsage(
  storeId: string,
  action: BillingAction,
  amount = 1,
  month = getCurrentUsageMonth(),
): Promise<BillingUsageSnapshot> {
  const key = usageKey(storeId, month);
  const current = usageStore.get(key) ?? emptyUsage(storeId, month);
  const increment = Math.max(0, Math.floor(amount));

  switch (action) {
    case "ai_execution":
      current.aiExecutions += increment;
      break;
    case "automation_create":
    case "automation_execute":
      current.automationExecutions += increment;
      break;
    case "connector_sync":
      current.connectorSyncs += increment;
      break;
    case "operations_create":
      current.operationsCreated += increment;
      break;
    case "api_request":
      current.apiRequests += increment;
      break;
    case "background_job":
      current.backgroundJobs += increment;
      break;
    case "data_export":
      current.dataExports += increment;
      break;
  }

  usageStore.set(key, current);
  return structuredClone(current);
}

export function clearBillingUsage(storeId?: string): void {
  if (!storeId) {
    usageStore.clear();
    return;
  }

  for (const key of usageStore.keys()) {
    if (key.startsWith(`${storeId}:`)) {
      usageStore.delete(key);
    }
  }
}

export function getUsageValueForAction(
  usage: BillingUsageSnapshot,
  action: BillingAction,
): number {
  switch (action) {
    case "ai_execution":
      return usage.aiExecutions;
    case "automation_create":
    case "automation_execute":
      return usage.automationExecutions;
    case "connector_sync":
      return usage.connectorSyncs;
    case "operations_create":
      return usage.operationsCreated;
    case "api_request":
      return usage.apiRequests;
    case "background_job":
      return usage.backgroundJobs;
    case "data_export":
      return usage.dataExports;
    default:
      return 0;
  }
}
