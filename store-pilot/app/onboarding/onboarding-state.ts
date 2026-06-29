import {
  createDefaultMerchantOnboardingRecord,
  markStepCompleted,
  markStepSkipped,
  type OnboardingPersistence,
} from "./onboarding-persistence";
import { getNextOnboardingStepId } from "./onboarding-progress";
import type { MerchantOnboardingRecord, OnboardingStepId } from "./onboarding-types";

export async function getOrCreateMerchantOnboardingState(
  storeId: string,
  persistence: OnboardingPersistence,
): Promise<MerchantOnboardingRecord> {
  const record = await persistence.load(storeId);
  if (record.createdAt) {
    return record;
  }
  const created = createDefaultMerchantOnboardingRecord(storeId);
  await persistence.save(created);
  return created;
}

export async function completeOnboardingStep(
  storeId: string,
  stepId: OnboardingStepId,
  persistence: OnboardingPersistence,
): Promise<MerchantOnboardingRecord> {
  const record = await getOrCreateMerchantOnboardingState(storeId, persistence);
  let next = markStepCompleted(record, stepId);

  if (stepId === "welcome") {
    next = { ...next, welcomeCompletedAt: new Date().toISOString() };
  }

  if (stepId === "executive_briefing") {
    next = {
      ...next,
      activated: true,
      activatedAt: new Date().toISOString(),
    };
  }

  next.currentStepId = getNextOnboardingStepId(next);
  await persistence.save(next);
  return next;
}

export async function skipOnboardingStep(
  storeId: string,
  stepId: OnboardingStepId,
  persistence: OnboardingPersistence,
): Promise<MerchantOnboardingRecord> {
  const record = await getOrCreateMerchantOnboardingState(storeId, persistence);
  const next = {
    ...markStepSkipped(record, stepId),
    currentStepId: getNextOnboardingStepId(markStepSkipped(record, stepId)),
  };
  await persistence.save(next);
  return next;
}

export async function setOnboardingCurrentStep(
  storeId: string,
  stepId: OnboardingStepId,
  persistence: OnboardingPersistence,
): Promise<MerchantOnboardingRecord> {
  const record = await getOrCreateMerchantOnboardingState(storeId, persistence);
  const next = { ...record, currentStepId: stepId, updatedAt: new Date().toISOString() };
  await persistence.save(next);
  return next;
}

export async function setDemoMode(
  storeId: string,
  enabled: boolean,
  persistence: OnboardingPersistence,
): Promise<MerchantOnboardingRecord> {
  const record = await getOrCreateMerchantOnboardingState(storeId, persistence);
  const next = { ...record, demoMode: enabled, updatedAt: new Date().toISOString() };
  await persistence.save(next);
  return next;
}

export async function updateAiInitializationState(
  storeId: string,
  patch: Partial<MerchantOnboardingRecord["aiInitialization"]>,
  persistence: OnboardingPersistence,
): Promise<MerchantOnboardingRecord> {
  const record = await getOrCreateMerchantOnboardingState(storeId, persistence);
  const next = {
    ...record,
    aiInitialization: { ...record.aiInitialization, ...patch },
    updatedAt: new Date().toISOString(),
  };
  await persistence.save(next);
  return next;
}

export function shouldRedirectToOnboarding(record: MerchantOnboardingRecord): boolean {
  return !record.activated && !record.demoMode;
}
