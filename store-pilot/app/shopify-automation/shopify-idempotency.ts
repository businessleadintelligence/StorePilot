import { createHash } from "node:crypto";

import type { AutomationExecutionResult } from "../automation/automation-executor";

export type IdempotencyRecord = {
  key: string;
  automationId: string;
  storeId: string;
  mutationHash: string;
  status: "in_progress" | "completed";
  result?: AutomationExecutionResult;
  createdAt: string;
  completedAt?: string;
};

const idempotencyStore = new Map<string, IdempotencyRecord>();

export function buildMutationHash(input: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export function buildIdempotencyKey(input: {
  automationId: string;
  storeId: string;
  mutationHash: string;
}): string {
  return `${input.storeId}:${input.automationId}:${input.mutationHash}`;
}

export function beginIdempotency(input: {
  key: string;
  automationId: string;
  storeId: string;
  mutationHash: string;
}): "proceed" | "duplicate_completed" | "duplicate_in_progress" {
  const existing = idempotencyStore.get(input.key);
  if (!existing) {
    idempotencyStore.set(input.key, {
      key: input.key,
      automationId: input.automationId,
      storeId: input.storeId,
      mutationHash: input.mutationHash,
      status: "in_progress",
      createdAt: new Date().toISOString(),
    });
    return "proceed";
  }

  if (existing.status === "completed" && existing.result) {
    return "duplicate_completed";
  }

  return "duplicate_in_progress";
}

export function completeIdempotency(key: string, result: AutomationExecutionResult): void {
  const existing = idempotencyStore.get(key);
  if (!existing) return;

  idempotencyStore.set(key, {
    ...existing,
    status: "completed",
    result,
    completedAt: new Date().toISOString(),
  });
}

export function getCompletedIdempotencyResult(key: string): AutomationExecutionResult | null {
  const existing = idempotencyStore.get(key);
  if (existing?.status === "completed" && existing.result) {
    return existing.result;
  }
  return null;
}

export function clearIdempotencyStore(): void {
  idempotencyStore.clear();
}
