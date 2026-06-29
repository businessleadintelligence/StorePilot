export type ShopifyAuditRecord = {
  id: string;
  timestamp: string;
  merchantId: string | null;
  storeId: string;
  automationId: string;
  operationId: string | null;
  mutationType: string;
  oldValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
  executionResult: "success" | "failed";
  shopifyRequestId: string | null;
  verificationStatus: "passed" | "failed" | "skipped";
  rollbackMetadata: Record<string, unknown>;
  merchantApprovalTimestamp: string | null;
  executionDurationMs: number;
};

const auditLog: ShopifyAuditRecord[] = [];

export function appendShopifyAuditRecord(
  record: Omit<ShopifyAuditRecord, "id" | "timestamp">,
): ShopifyAuditRecord {
  const entry: ShopifyAuditRecord = {
    id: `audit:${record.automationId}:${Date.now()}:${auditLog.length}`,
    timestamp: new Date().toISOString(),
    ...record,
  };
  auditLog.unshift(entry);
  return entry;
}

export function listShopifyAuditRecords(filter?: {
  storeId?: string;
  automationId?: string;
}): ShopifyAuditRecord[] {
  return auditLog.filter((record) => {
    if (filter?.storeId && record.storeId !== filter.storeId) return false;
    if (filter?.automationId && record.automationId !== filter.automationId) return false;
    return true;
  });
}

export function clearShopifyAuditLog(): void {
  auditLog.length = 0;
}
