import type { StoreOperation } from "../operations/operations-types";
import type {
  AutomationCenterData,
  AutomationNotification,
  CreateAutomationInput,
  StoreAutomation,
} from "./automation-types";
import {
  createAutomationRecord,
  createInMemoryAutomationPersistence,
  loadAutomationSnapshot,
  saveAutomationSnapshot,
  upsertAutomationInSnapshot,
  buildAutomationKey,
  type AutomationPersistence,
} from "./automation-persistence";
import { getAutomationTemplate, inferAutomationTemplateId } from "./automation-templates";
import { buildAutomationPreview } from "./automation-preview";
import { assessAutomationRisk, buildRollbackPlan } from "./automation-risk";
import {
  validateCreateAutomationInput,
  validateDuplicateAutomation,
} from "./automation-validator";
import { appendAutomationHistory } from "./automation-history";
import {
  buildAutomationFromOperation,
  rankAutomationQueue,
  shouldPrepareFromOperation,
} from "./automation-planner";
import {
  buildAutomationCharts,
  calculateAutomationMetrics,
  suggestTemplateFromLearning,
} from "./automation-metrics";
import { serializePreviewForMerchant } from "./automation-preview";

export function buildAutomationNotification(input: {
  automation: StoreAutomation;
  type: string;
  title: string;
  message: string;
}): AutomationNotification {
  return {
    id: `${input.automation.id}:${input.type}:${Date.now()}`,
    automationId: input.automation.id,
    type: input.type,
    title: input.title,
    message: input.message,
    at: new Date().toISOString(),
    read: false,
  };
}

export function notificationForAutomationStatus(input: {
  automation: StoreAutomation;
  toStatus: StoreAutomation["status"];
}): AutomationNotification | null {
  switch (input.toStatus) {
    case "waiting_approval":
      return buildAutomationNotification({
        automation: input.automation,
        type: "automation_waiting_approval",
        title: "Waiting approval",
        message: `${input.automation.title} requires merchant approval before execution.`,
      });
    case "approved":
      return buildAutomationNotification({
        automation: input.automation,
        type: "automation_approved",
        title: "Automation approved",
        message: `${input.automation.title} is approved and ready for simulated execution.`,
      });
    case "executed":
      return buildAutomationNotification({
        automation: input.automation,
        type: "automation_executed",
        title: "Automation executed",
        message: `${input.automation.title} completed simulated execution.`,
      });
    case "verified":
      return buildAutomationNotification({
        automation: input.automation,
        type: "automation_verified",
        title: "Automation verified",
        message: `${input.automation.title} passed verification.`,
      });
    case "cancelled":
      return buildAutomationNotification({
        automation: input.automation,
        type: input.automation.merchantRejected ? "automation_rejected" : "automation_cancelled",
        title: input.automation.merchantRejected ? "Automation rejected" : "Automation cancelled",
        message: input.automation.changeRequestNote ?? `${input.automation.title} was cancelled.`,
      });
    case "archived":
      return buildAutomationNotification({
        automation: input.automation,
        type: "automation_archived",
        title: "Automation archived",
        message: `${input.automation.title} has been archived.`,
      });
    default:
      return null;
  }
}

export async function buildAutomationCenterData(input: {
  storeId: string;
  persistence?: AutomationPersistence;
}): Promise<AutomationCenterData> {
  const snapshot = await loadAutomationSnapshot(input.storeId, input.persistence);
  const active = snapshot.automations.filter((automation) => automation.status !== "archived");
  const metrics = calculateAutomationMetrics(active);
  const charts = buildAutomationCharts(active, metrics);

  return {
    pendingApprovals: active.filter((automation) => automation.status === "waiting_approval"),
    automationQueue: rankAutomationQueue(
      active.filter((automation) => ["prepared", "approved", "executing"].includes(automation.status)),
    ),
    executionTimeline: snapshot.history.slice(0, 50),
    verificationQueue: active.filter((automation) => automation.status === "verifying"),
    automationHistory: snapshot.history.slice(0, 50),
    riskAnalysis: active.map((automation) => ({
      automationId: automation.id,
      title: automation.title,
      riskLevel: automation.riskLevel,
      factors: automation.riskFactors,
    })),
    metrics,
    charts,
    notifications: snapshot.notifications.slice(0, 20),
  };
}

export async function createAutomationRecordForStore(input: {
  createInput: CreateAutomationInput;
  persistence?: AutomationPersistence;
}): Promise<StoreAutomation> {
  validateCreateAutomationInput(input.createInput);
  const persistence = input.persistence ?? createInMemoryAutomationPersistence();
  const snapshot = await loadAutomationSnapshot(input.createInput.storeId, persistence);

  const templateId =
    input.createInput.templateId ??
    suggestTemplateFromLearning(snapshot.learning, [inferAutomationTemplateId({ title: input.createInput.title })]) ??
    inferAutomationTemplateId({ title: input.createInput.title });
  const template = getAutomationTemplate(templateId);
  const products = input.createInput.products ?? template.defaultProducts;
  const automationKey = buildAutomationKey(
    input.createInput.sourceType,
    input.createInput.sourceId,
    templateId,
  );

  validateDuplicateAutomation(snapshot.automations, automationKey);

  const preview = buildAutomationPreview({
    template,
    title: input.createInput.title,
    products,
  });
  const { riskLevel, riskFactors } = assessAutomationRisk({
    template,
    products,
    createInput: input.createInput,
  });
  const rollbackPlan = buildRollbackPlan({
    template,
    products,
    payload: input.createInput.payload,
  });

  let automation = createAutomationRecord({
    createInput: input.createInput,
    templateId,
    preview,
    rollbackPlan,
    verificationRules: template.verificationRules.map((rule) => ({ ...rule })),
    riskLevel,
    riskFactors,
  });

  const notification = buildAutomationNotification({
    automation,
    type: "automation_created",
    title: "Automation created",
    message: `${automation.title} is in draft. Preview available.`,
  });

  const history = appendAutomationHistory({
    history: snapshot.history,
    automation,
    eventType: "created",
    message: "Automation created from operation",
    payload: { preview: serializePreviewForMerchant(automation) },
  });

  await saveAutomationSnapshot(
    input.createInput.storeId,
    upsertAutomationInSnapshot({ snapshot: { ...snapshot, history }, automation, notification }),
    persistence,
  );

  return automation;
}

export async function syncAutomationsFromOperations(input: {
  storeId: string;
  operations: StoreOperation[];
  persistence?: AutomationPersistence;
}): Promise<StoreAutomation[]> {
  const created: StoreAutomation[] = [];
  for (const operation of input.operations) {
    if (!shouldPrepareFromOperation(operation)) continue;
    try {
      const automation = await createAutomationRecordForStore({
        createInput: buildAutomationFromOperation(operation),
        persistence: input.persistence,
      });
      created.push(automation);
    } catch (error) {
      if (error instanceof Error && error.message.includes("duplicate_automation")) continue;
      throw error;
    }
  }
  return created;
}

export { appendAutomationHistory };
