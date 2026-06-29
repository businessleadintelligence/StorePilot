import type { MerchantOnboardingRecord, OnboardingStepId } from "../onboarding-types";

export const STORE_ID = "store-test-001";

export function buildMerchantOnboardingRecord(
  overrides: Partial<MerchantOnboardingRecord> = {},
): MerchantOnboardingRecord {
  const now = new Date().toISOString();
  return {
    storeId: STORE_ID,
    currentStepId: "welcome",
    completedStepIds: [],
    skippedStepIds: [],
    demoMode: false,
    activated: false,
    activatedAt: null,
    welcomeCompletedAt: null,
    aiInitialization: {
      status: "idle",
      completedAgents: [],
      failedAgents: [],
      currentAgentId: null,
      startedAt: null,
      completedAt: null,
      lastError: null,
    },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function buildCompletedSteps(...stepIds: OnboardingStepId[]): MerchantOnboardingRecord {
  return buildMerchantOnboardingRecord({
    completedStepIds: stepIds,
    currentStepId: stepIds.at(-1) === "executive_briefing" ? "executive_briefing" : "google",
  });
}
