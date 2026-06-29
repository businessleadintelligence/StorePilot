import type { CreateOperationInput, StoreOperation } from "./operations-types";

export class OperationsValidationError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "OperationsValidationError";
  }
}

export function validateCreateOperationInput(input: CreateOperationInput): void {
  if (!input.storeId.trim()) throw new OperationsValidationError("missing_store_id");
  if (!input.title.trim() || input.title.trim().length < 5) {
    throw new OperationsValidationError("invalid_title");
  }
  if (!input.sourceId.trim()) throw new OperationsValidationError("missing_source_id");
}

export function validateOperationTransition(input: {
  operation: StoreOperation;
  toStatus: StoreOperation["status"];
}): void {
  const allowed: Record<StoreOperation["status"], StoreOperation["status"][]> = {
    pending: ["approved", "archived"],
    approved: ["in_progress", "archived"],
    in_progress: ["paused", "blocked", "verification", "completed"],
    paused: ["in_progress", "archived"],
    blocked: ["in_progress", "archived"],
    verification: ["completed", "verified", "in_progress"],
    completed: ["verified", "verification"],
    verified: ["archived"],
    archived: [],
  };

  if (!allowed[input.operation.status].includes(input.toStatus)) {
    throw new OperationsValidationError(`invalid_transition:${input.operation.status}->${input.toStatus}`);
  }
}

export function validateVerificationComplete(operation: StoreOperation): void {
  if (operation.verificationRules.length === 0) {
    throw new OperationsValidationError("missing_verification_rules");
  }
  if (!operation.verificationRules.every((rule) => rule.satisfied)) {
    throw new OperationsValidationError("verification_not_satisfied");
  }
}

export function validateDuplicateOperation(
  existing: StoreOperation[],
  sourceId: string,
): void {
  if (existing.some((operation) => operation.sourceId === sourceId && operation.status !== "archived")) {
    throw new OperationsValidationError("duplicate_operation");
  }
}
