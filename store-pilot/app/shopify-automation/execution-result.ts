export type AutomationExecutionResult = {
  automationId: string;
  executedAt: string;
  shopifyMutationsExecuted: boolean;
  simulatedChanges: string[];
  message: string;
  auditRecordId?: string;
  shopifyRequestId?: string | null;
  verificationStatus?: "passed" | "failed" | "skipped";
  rollbackMetadata?: Record<string, unknown>;
  mutationType?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  executionDurationMs?: number;
  idempotencyKey?: string;
};
