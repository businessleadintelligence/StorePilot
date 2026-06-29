import type { MerchantOnboardingRecord, OnboardingAiInitializationState, OnboardingStepId } from "./onboarding-types";

export type OnboardingPersistence = {
  load(storeId: string): Promise<MerchantOnboardingRecord>;
  save(record: MerchantOnboardingRecord): Promise<void>;
  delete(storeId: string): Promise<void>;
};

function defaultAiState(): OnboardingAiInitializationState {
  return {
    status: "idle",
    completedAgents: [],
    failedAgents: [],
    currentAgentId: null,
    startedAt: null,
    completedAt: null,
    lastError: null,
  };
}

export function createDefaultMerchantOnboardingRecord(storeId: string): MerchantOnboardingRecord {
  const now = new Date().toISOString();
  return {
    storeId,
    currentStepId: "welcome",
    completedStepIds: [],
    skippedStepIds: [],
    demoMode: false,
    activated: false,
    activatedAt: null,
    welcomeCompletedAt: null,
    aiInitialization: defaultAiState(),
    createdAt: now,
    updatedAt: now,
  };
}

const memoryStore = new Map<string, MerchantOnboardingRecord>();

export function createInMemoryOnboardingPersistence(): OnboardingPersistence {
  return {
    async load(storeId) {
      return structuredClone(memoryStore.get(storeId) ?? createDefaultMerchantOnboardingRecord(storeId));
    },
    async save(record) {
      memoryStore.set(record.storeId, structuredClone(record));
    },
    async delete(storeId) {
      memoryStore.delete(storeId);
    },
  };
}

export function clearOnboardingPersistence(storeId?: string): void {
  if (storeId) {
    memoryStore.delete(storeId);
    return;
  }
  memoryStore.clear();
}

export function markStepCompleted(
  record: MerchantOnboardingRecord,
  stepId: OnboardingStepId,
): MerchantOnboardingRecord {
  const completedStepIds = record.completedStepIds.includes(stepId)
    ? record.completedStepIds
    : [...record.completedStepIds, stepId];
  const skippedStepIds = record.skippedStepIds.filter((item) => item !== stepId);
  return {
    ...record,
    completedStepIds,
    skippedStepIds,
    updatedAt: new Date().toISOString(),
  };
}

export function markStepSkipped(
  record: MerchantOnboardingRecord,
  stepId: OnboardingStepId,
): MerchantOnboardingRecord {
  const skippedStepIds = record.skippedStepIds.includes(stepId)
    ? record.skippedStepIds
    : [...record.skippedStepIds, stepId];
  const completedStepIds = record.completedStepIds.filter((item) => item !== stepId);
  return {
    ...record,
    skippedStepIds,
    completedStepIds,
    updatedAt: new Date().toISOString(),
  };
}
