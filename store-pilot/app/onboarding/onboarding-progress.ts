import type {
  MerchantOnboardingRecord,
  OnboardingLifecycleStage,
  OnboardingProgress,
  OnboardingStepDefinition,
  OnboardingStepId,
} from "./onboarding-types";
import { ONBOARDING_STEP_DEFINITIONS, ONBOARDING_STEP_IDS } from "./onboarding-types";

export function getNextOnboardingStepId(record: MerchantOnboardingRecord): OnboardingStepId {
  for (const stepId of ONBOARDING_STEP_IDS) {
    if (!record.completedStepIds.includes(stepId) && !record.skippedStepIds.includes(stepId)) {
      return stepId;
    }
  }
  return "executive_briefing";
}

export function computeOnboardingProgress(input: {
  record: MerchantOnboardingRecord;
  stepStatuses: Partial<Record<OnboardingStepId, { status: string; autoComplete?: boolean }>>;
}): OnboardingProgress {
  const completedCount = ONBOARDING_STEP_IDS.filter(
    (stepId) =>
      input.record.completedStepIds.includes(stepId) ||
      input.record.skippedStepIds.includes(stepId) ||
      input.stepStatuses[stepId]?.status === "completed" ||
      input.stepStatuses[stepId]?.status === "skipped",
  ).length;

  const remainingSteps = ONBOARDING_STEP_IDS.length - completedCount;
  const completionPercent = Math.round((completedCount / ONBOARDING_STEP_IDS.length) * 100);
  const blockedSteps = ONBOARDING_STEP_IDS.filter(
    (stepId) => input.stepStatuses[stepId]?.status === "blocked",
  );

  const estimatedMinutesRemaining = ONBOARDING_STEP_DEFINITIONS.filter(
    (step) =>
      !input.record.completedStepIds.includes(step.id) &&
      !input.record.skippedStepIds.includes(step.id),
  ).reduce((sum, step) => sum + step.estimatedMinutes, 0);

  return {
    completionPercent,
    remainingSteps,
    estimatedMinutesRemaining,
    recommendedNextAction: buildRecommendedNextAction(input.record, input.stepStatuses),
    blockedSteps,
    skippedSteps: [...input.record.skippedStepIds],
    lifecycleStage: deriveLifecycleStage(input.record, completionPercent),
  };
}

function buildRecommendedNextAction(
  record: MerchantOnboardingRecord,
  stepStatuses: Partial<Record<OnboardingStepId, { status: string }>>,
): string {
  if (record.demoMode) {
    return "Exit demo mode to connect your real store data";
  }

  const current = stepStatuses[record.currentStepId];
  if (current?.status === "blocked") {
    return `Resolve ${findStepDefinition(record.currentStepId).label} before continuing`;
  }

  return `Continue with ${findStepDefinition(record.currentStepId).label}`;
}

function deriveLifecycleStage(
  record: MerchantOnboardingRecord,
  completionPercent: number,
): OnboardingLifecycleStage {
  if (record.activated) {
    return completionPercent >= 100 ? "active" : "activated";
  }

  if (record.aiInitialization.status === "completed") {
    return "analyzed";
  }

  if (record.completedStepIds.includes("shopify_sync")) {
    return "synced";
  }

  if (
    record.completedStepIds.includes("google") ||
    record.skippedStepIds.some((step) =>
      ["google", "ga4", "search_console", "pagespeed", "clarity"].includes(step),
    )
  ) {
    return "configured";
  }

  if (record.completedStepIds.includes("shopify")) {
    return "connected";
  }

  return "installed";
}

export function findStepDefinition(stepId: OnboardingStepId): OnboardingStepDefinition {
  return ONBOARDING_STEP_DEFINITIONS.find((step) => step.id === stepId) ?? ONBOARDING_STEP_DEFINITIONS[0];
}

export function isOnboardingStepSkippable(stepId: OnboardingStepId): boolean {
  return findStepDefinition(stepId).skippable;
}
