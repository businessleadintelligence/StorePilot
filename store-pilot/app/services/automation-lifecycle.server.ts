import type { AutomationStatus, StoreAutomation } from "../automation/automation-types";
import {
  createInMemoryAutomationPersistence,
  loadAutomationSnapshot,
  saveAutomationSnapshot,
  upsertAutomationInSnapshot,
  type AutomationPersistence,
} from "../automation/automation-persistence";
import {
  assertAutomationTransition,
  timelineFieldForStatus,
} from "../automation/automation-state";
import {
  validateAutomationApproval,
  validateAutomationExecution,
  validateAutomationTransition,
  validateVerificationComplete,
} from "../automation/automation-validator";
import { executeAutomationPlan } from "../automation/automation-executor";
import {
  applyVerificationSignals,
  canVerifyAutomation,
} from "../automation/automation-verification";
import { appendAutomationHistory } from "../automation/automation-history";
import { notificationForAutomationStatus } from "../automation/automation-engine";
import { updateAutomationLearningProfile } from "../automation/automation-metrics";
import { serializePreviewForMerchant } from "../automation/automation-preview";

export type AutomationLifecycleStep =
  | "prepare"
  | "submit_for_approval"
  | "approve"
  | "reject"
  | "request_changes"
  | "execute"
  | "verify"
  | "archive"
  | "cancel";

export function resolveLifecycleTransition(
  step: AutomationLifecycleStep,
  currentStatus: AutomationStatus,
): AutomationStatus {
  switch (step) {
    case "prepare":
      return currentStatus === "draft" ? "prepared" : currentStatus;
    case "submit_for_approval":
      return currentStatus === "prepared" ? "waiting_approval" : currentStatus;
    case "approve":
      return "approved";
    case "reject":
      return "cancelled";
    case "request_changes":
      return "prepared";
    case "execute":
      if (currentStatus === "approved") return "executing";
      if (currentStatus === "executing") return "executed";
      return currentStatus;
    case "verify":
      if (currentStatus === "executed") return "verifying";
      if (currentStatus === "verifying") return "verified";
      return currentStatus;
    case "archive":
      return "archived";
    case "cancel":
      return "cancelled";
    default:
      return currentStatus;
  }
}

export async function transitionAutomation(input: {
  storeId: string;
  automationId: string;
  toStatus: AutomationStatus;
  persistence?: AutomationPersistence;
  changeRequestNote?: string | null;
  merchantRejected?: boolean;
  verificationMetrics?: Record<string, number | boolean | string>;
}): Promise<StoreAutomation> {
  const persistence = input.persistence ?? createInMemoryAutomationPersistence();
  const snapshot = await loadAutomationSnapshot(input.storeId, persistence);
  const automation = snapshot.automations.find((item) => item.id === input.automationId);
  if (!automation) throw new Error("automation_not_found");

  validateAutomationTransition({ automation, toStatus: input.toStatus });
  assertAutomationTransition(automation.status, input.toStatus);

  const now = new Date().toISOString();
  const timelineField = timelineFieldForStatus(input.toStatus);
  let updated: StoreAutomation = {
    ...automation,
    status: input.toStatus,
    updatedAt: now,
    timeline: {
      ...automation.timeline,
      ...(timelineField ? { [timelineField]: now } : {}),
    },
  };

  if (input.toStatus === "approved") {
    validateAutomationApproval(automation);
    updated = { ...updated, merchantApproved: true, merchantRejected: false, changeRequestNote: null };
  }
  if (input.toStatus === "cancelled") {
    updated = {
      ...updated,
      merchantRejected: input.merchantRejected ?? false,
      changeRequestNote: input.changeRequestNote ?? null,
      merchantApproved: false,
    };
  }
  if (input.toStatus === "prepared" && input.changeRequestNote) {
    updated = { ...updated, changeRequestNote: input.changeRequestNote, merchantApproved: false };
  }
  if (input.toStatus === "executing") {
    validateAutomationExecution(automation);
  }
  if (input.toStatus === "executed") {
    const result = await executeAutomationPlan(updated);
    updated = {
      ...updated,
      rollbackPlan: {
        ...updated.rollbackPlan,
        afterState: { ...updated.rollbackPlan.afterState, executionResult: result },
      },
    };
  }
  if (input.toStatus === "verifying" && input.verificationMetrics) {
    updated = applyVerificationSignals(updated, input.verificationMetrics);
  }
  if (input.toStatus === "verified") {
    if (input.verificationMetrics) {
      updated = applyVerificationSignals(updated, input.verificationMetrics);
    }
    validateVerificationComplete(updated);
    if (!canVerifyAutomation(updated)) throw new Error("verification_incomplete");
  }

  const history = appendAutomationHistory({
    history: snapshot.history,
    automation: updated,
    eventType: `status_${input.toStatus}`,
    message: `Automation moved to ${input.toStatus}`,
  });

  const notification = notificationForAutomationStatus({ automation: updated, toStatus: input.toStatus });

  if (input.toStatus === "approved") {
    snapshot.learning = updateAutomationLearningProfile({
      learning: snapshot.learning,
      automation: updated,
      action: "approved",
    });
  }
  if (input.toStatus === "cancelled" && input.merchantRejected) {
    snapshot.learning = updateAutomationLearningProfile({
      learning: snapshot.learning,
      automation: updated,
      action: "rejected",
    });
  }
  if (input.toStatus === "verified") {
    snapshot.learning = updateAutomationLearningProfile({
      learning: snapshot.learning,
      automation: updated,
      action: "verified",
    });
  }

  await saveAutomationSnapshot(
    input.storeId,
    upsertAutomationInSnapshot({
      snapshot: { ...snapshot, history, learning: snapshot.learning },
      automation: updated,
      notification: notification ?? undefined,
    }),
    persistence,
  );

  return updated;
}

export async function runAutomationLifecycle(input: {
  storeId: string;
  automationId: string;
  step: AutomationLifecycleStep;
  persistence?: AutomationPersistence;
  changeRequestNote?: string;
  verificationMetrics?: Record<string, number | boolean | string>;
}): Promise<StoreAutomation> {
  const persistence = input.persistence ?? createInMemoryAutomationPersistence();
  const snapshot = await loadAutomationSnapshot(input.storeId, persistence);
  const automation = snapshot.automations.find((item) => item.id === input.automationId);
  if (!automation) throw new Error("automation_not_found");

  const toStatus = resolveLifecycleTransition(input.step, automation.status);
  if (toStatus === automation.status && input.step !== "execute") {
    throw new Error(`invalid_lifecycle_step:${input.step}`);
  }

  if (input.step === "execute") {
    await transitionAutomation({ ...input, toStatus: "executing", persistence });
    return transitionAutomation({ ...input, toStatus: "executed", persistence });
  }

  if (input.step === "verify") {
    await transitionAutomation({
      ...input,
      toStatus: "verifying",
      verificationMetrics: input.verificationMetrics,
      persistence,
    });
    return transitionAutomation({
      ...input,
      toStatus: "verified",
      verificationMetrics: input.verificationMetrics,
      persistence,
    });
  }

  return transitionAutomation({
    storeId: input.storeId,
    automationId: input.automationId,
    toStatus,
    persistence,
    changeRequestNote: input.changeRequestNote,
    merchantRejected: input.step === "reject",
    verificationMetrics: input.verificationMetrics,
  });
}

export function previewAutomationLifecycle(automation: StoreAutomation): string {
  return serializePreviewForMerchant(automation);
}
