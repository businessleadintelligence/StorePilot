import type { CreateAutomationInput, StoreAutomation } from "../automation/automation-types";
import {
  createInMemoryAutomationPersistence,
  loadAutomationSnapshot,
  type AutomationPersistence,
} from "../automation/automation-persistence";
import {
  buildAutomationCenterData,
  createAutomationRecordForStore,
  syncAutomationsFromOperations,
} from "../automation/automation-engine";
import { serializePreviewForMerchant } from "../automation/automation-preview";
import { listOperations } from "./operations.server";
import {
  runAutomationLifecycle,
  transitionAutomation,
} from "./automation-lifecycle.server";

export type {
  AutomationCenterData,
  AutomationMetrics,
  CreateAutomationInput,
  StoreAutomation,
} from "../automation/automation-types";

function getPersistence(persistence?: AutomationPersistence) {
  return persistence ?? createInMemoryAutomationPersistence();
}

export async function createAutomation(
  input: CreateAutomationInput & { persistence?: AutomationPersistence },
): Promise<StoreAutomation> {
  const automation = await createAutomationRecordForStore({
    createInput: input,
    persistence: input.persistence,
  });
  return transitionAutomation({
    storeId: input.storeId,
    automationId: automation.id,
    toStatus: "prepared",
    persistence: input.persistence,
  });
}

export async function previewAutomation(input: {
  storeId: string;
  automationId: string;
  persistence?: AutomationPersistence;
}): Promise<string> {
  const snapshot = await loadAutomationSnapshot(input.storeId, getPersistence(input.persistence));
  const automation = snapshot.automations.find((item) => item.id === input.automationId);
  if (!automation) throw new Error("automation_not_found");
  return serializePreviewForMerchant(automation);
}

export async function submitAutomationForApproval(input: {
  storeId: string;
  automationId: string;
  persistence?: AutomationPersistence;
}): Promise<StoreAutomation> {
  return transitionAutomation({
    storeId: input.storeId,
    automationId: input.automationId,
    toStatus: "waiting_approval",
    persistence: input.persistence,
  });
}

export async function approveAutomation(input: {
  storeId: string;
  automationId: string;
  persistence?: AutomationPersistence;
}): Promise<StoreAutomation> {
  const persistence = getPersistence(input.persistence);
  const snapshot = await loadAutomationSnapshot(input.storeId, persistence);
  const automation = snapshot.automations.find((item) => item.id === input.automationId);
  if (!automation) throw new Error("automation_not_found");

  if (automation.status === "prepared") {
    await transitionAutomation({
      storeId: input.storeId,
      automationId: input.automationId,
      toStatus: "waiting_approval",
      persistence,
    });
  }

  return transitionAutomation({
    storeId: input.storeId,
    automationId: input.automationId,
    toStatus: "approved",
    persistence,
  });
}

export async function rejectAutomation(input: {
  storeId: string;
  automationId: string;
  note?: string;
  persistence?: AutomationPersistence;
}): Promise<StoreAutomation> {
  return transitionAutomation({
    storeId: input.storeId,
    automationId: input.automationId,
    toStatus: "cancelled",
    merchantRejected: true,
    changeRequestNote: input.note ?? "Rejected by merchant",
    persistence: input.persistence,
  });
}

export async function requestAutomationChanges(input: {
  storeId: string;
  automationId: string;
  note: string;
  persistence?: AutomationPersistence;
}): Promise<StoreAutomation> {
  return transitionAutomation({
    storeId: input.storeId,
    automationId: input.automationId,
    toStatus: "prepared",
    changeRequestNote: input.note,
    persistence: input.persistence,
  });
}

export async function cancelAutomation(input: {
  storeId: string;
  automationId: string;
  persistence?: AutomationPersistence;
}): Promise<StoreAutomation> {
  return transitionAutomation({
    storeId: input.storeId,
    automationId: input.automationId,
    toStatus: "cancelled",
    persistence: input.persistence,
  });
}

export async function executeAutomation(input: {
  storeId: string;
  automationId: string;
  persistence?: AutomationPersistence;
}): Promise<StoreAutomation> {
  return runAutomationLifecycle({
    storeId: input.storeId,
    automationId: input.automationId,
    step: "execute",
    persistence: input.persistence,
  });
}

export async function verifyAutomation(input: {
  storeId: string;
  automationId: string;
  metrics?: Record<string, number | boolean | string>;
  persistence?: AutomationPersistence;
}): Promise<StoreAutomation> {
  const snapshot = await loadAutomationSnapshot(input.storeId, getPersistence(input.persistence));
  const automation = snapshot.automations.find((item) => item.id === input.automationId);
  const defaultMetrics: Record<string, boolean> = {};
  if (automation) {
    for (const rule of automation.verificationRules) {
      defaultMetrics[rule.metric] = true;
    }
  }

  return runAutomationLifecycle({
    storeId: input.storeId,
    automationId: input.automationId,
    step: "verify",
    verificationMetrics: input.metrics ?? defaultMetrics,
    persistence: input.persistence,
  });
}

export async function archiveAutomation(input: {
  storeId: string;
  automationId: string;
  persistence?: AutomationPersistence;
}): Promise<StoreAutomation> {
  return transitionAutomation({
    storeId: input.storeId,
    automationId: input.automationId,
    toStatus: "archived",
    persistence: input.persistence,
  });
}

export async function listAutomations(input: {
  storeId: string;
  persistence?: AutomationPersistence;
}): Promise<StoreAutomation[]> {
  const snapshot = await loadAutomationSnapshot(input.storeId, getPersistence(input.persistence));
  return snapshot.automations.filter((automation) => automation.status !== "archived");
}

export async function getAutomationCenterData(input: {
  storeId: string;
  persistence?: AutomationPersistence;
  syncFromOperations?: boolean;
}) {
  const persistence = getPersistence(input.persistence);

  if (input.syncFromOperations !== false) {
    const operations = await listOperations({ storeId: input.storeId, persistence: undefined });
    await syncAutomationsFromOperations({
      storeId: input.storeId,
      operations,
      persistence,
    });
  }

  return buildAutomationCenterData({ storeId: input.storeId, persistence });
}

export function serializeAutomationCenterForLoader<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}

export { createInMemoryAutomationPersistence } from "../automation/automation-persistence";
