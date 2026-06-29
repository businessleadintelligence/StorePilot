import { randomUUID, createHash } from "node:crypto";
import type {
  AutomationHistoryEvent,
  AutomationLearningProfile,
  AutomationNotification,
  AutomationStoreSnapshot,
  CreateAutomationInput,
  StoreAutomation,
} from "./automation-types";

export type AutomationPersistence = {
  loadSnapshot(storeId: string): Promise<AutomationStoreSnapshot>;
  saveSnapshot(storeId: string, snapshot: AutomationStoreSnapshot): Promise<void>;
};

function defaultLearning(): AutomationLearningProfile {
  return {
    approvedCategories: [],
    rejectedCategories: [],
    delayedCategories: [],
    preferredTemplates: [],
    approvalRate: 0,
  };
}

function emptySnapshot(): AutomationStoreSnapshot {
  return {
    automations: [],
    history: [],
    notifications: [],
    learning: defaultLearning(),
  };
}

const memoryStore = new Map<string, AutomationStoreSnapshot>();

export function buildAutomationKey(sourceType: string, sourceId: string, templateId: string): string {
  return createHash("sha256").update(`${sourceType}:${sourceId}:${templateId}`).digest("hex").slice(0, 32);
}

export function createInMemoryAutomationPersistence(): AutomationPersistence {
  return {
    async loadSnapshot(storeId) {
      return structuredClone(memoryStore.get(storeId) ?? emptySnapshot());
    },
    async saveSnapshot(storeId, snapshot) {
      memoryStore.set(storeId, structuredClone(snapshot));
    },
  };
}

export function createPrismaAutomationPersistence(): AutomationPersistence {
  return createInMemoryAutomationPersistence();
}

export async function loadAutomationSnapshot(
  storeId: string,
  persistence = createInMemoryAutomationPersistence(),
): Promise<AutomationStoreSnapshot> {
  return persistence.loadSnapshot(storeId);
}

export async function saveAutomationSnapshot(
  storeId: string,
  snapshot: AutomationStoreSnapshot,
  persistence = createInMemoryAutomationPersistence(),
): Promise<void> {
  await persistence.saveSnapshot(storeId, snapshot);
}

export function upsertAutomationInSnapshot(input: {
  snapshot: AutomationStoreSnapshot;
  automation: StoreAutomation;
  historyEvent?: AutomationHistoryEvent;
  notification?: AutomationNotification;
}): AutomationStoreSnapshot {
  return {
    automations: [
      input.automation,
      ...input.snapshot.automations.filter((item) => item.id !== input.automation.id),
    ],
    history: input.historyEvent ? [input.historyEvent, ...input.snapshot.history] : input.snapshot.history,
    notifications: input.notification
      ? [input.notification, ...input.snapshot.notifications]
      : input.snapshot.notifications,
    learning: input.snapshot.learning,
  };
}

export function createAutomationRecord(input: {
  createInput: CreateAutomationInput;
  templateId: string;
  preview: StoreAutomation["preview"];
  rollbackPlan: StoreAutomation["rollbackPlan"];
  verificationRules: StoreAutomation["verificationRules"];
  riskLevel: StoreAutomation["riskLevel"];
  riskFactors: string[];
}): StoreAutomation {
  const now = new Date().toISOString();
  const automationKey = buildAutomationKey(
    input.createInput.sourceType,
    input.createInput.sourceId,
    input.templateId,
  );

  return {
    id: randomUUID(),
    storeId: input.createInput.storeId,
    automationKey,
    title: input.createInput.title,
    summary: input.createInput.summary ?? input.createInput.title,
    status: "draft",
    templateId: input.templateId,
    sourceType: input.createInput.sourceType,
    sourceId: input.createInput.sourceId,
    operationId: input.createInput.operationId ?? null,
    riskLevel: input.riskLevel,
    riskFactors: input.riskFactors,
    preview: input.preview,
    rollbackPlan: input.rollbackPlan,
    verificationRules: input.verificationRules,
    approvalRequired: true,
    merchantApproved: false,
    merchantRejected: false,
    changeRequestNote: null,
    timeline: {
      created: now,
      prepared: null,
      waitingApproval: null,
      approved: null,
      executing: null,
      executed: null,
      verifying: null,
      verified: null,
      archived: null,
      cancelled: null,
    },
    estimatedTimeSavedMinutes: input.preview.estimatedTimeSavedMinutes,
    revenueInfluenced: input.createInput.revenueInfluenced ?? 0,
    createdAt: now,
    updatedAt: now,
  };
}
