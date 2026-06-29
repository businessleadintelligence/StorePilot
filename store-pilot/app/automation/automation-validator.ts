import type { AutomationStatus, CreateAutomationInput, StoreAutomation } from "./automation-types";

export class AutomationValidationError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "AutomationValidationError";
  }
}

export function validateCreateAutomationInput(input: CreateAutomationInput): void {
  if (!input.storeId.trim()) throw new AutomationValidationError("missing_store_id");
  if (!input.title.trim() || input.title.trim().length < 3) {
    throw new AutomationValidationError("invalid_title");
  }
  if (!input.sourceId.trim()) throw new AutomationValidationError("missing_source_id");
}

export function validateAutomationTransition(input: {
  automation: StoreAutomation;
  toStatus: AutomationStatus;
}): void {
  const allowed: Record<AutomationStatus, AutomationStatus[]> = {
    draft: ["prepared", "cancelled"],
    prepared: ["waiting_approval", "cancelled"],
    waiting_approval: ["approved", "prepared", "cancelled"],
    approved: ["executing", "cancelled"],
    executing: ["executed", "cancelled"],
    executed: ["verifying", "cancelled"],
    verifying: ["verified", "executed"],
    verified: ["archived"],
    archived: [],
    cancelled: [],
  };

  if (!allowed[input.automation.status].includes(input.toStatus)) {
    throw new AutomationValidationError(
      `invalid_transition:${input.automation.status}->${input.toStatus}`,
    );
  }
}

export function validateAutomationApproval(automation: StoreAutomation): void {
  if (!automation.approvalRequired) {
    throw new AutomationValidationError("approval_required");
  }
  if (automation.status !== "waiting_approval" && automation.status !== "approved") {
    throw new AutomationValidationError("not_ready_for_approval");
  }
}

export function validateAutomationExecution(automation: StoreAutomation): void {
  if (!automation.merchantApproved) {
    throw new AutomationValidationError("merchant_approval_required");
  }
  if (automation.status !== "approved") {
    throw new AutomationValidationError("automation_not_approved");
  }
}

export function validateVerificationComplete(automation: StoreAutomation): void {
  if (automation.verificationRules.length === 0) {
    throw new AutomationValidationError("missing_verification_rules");
  }
  if (!automation.verificationRules.every((rule) => rule.satisfied)) {
    throw new AutomationValidationError("verification_not_satisfied");
  }
}

export function validateDuplicateAutomation(
  existing: StoreAutomation[],
  automationKey: string,
): void {
  if (
    existing.some(
      (automation) => automation.automationKey === automationKey && automation.status !== "archived",
    )
  ) {
    throw new AutomationValidationError("duplicate_automation");
  }
}
