import { describe, expect, it } from "vitest";

import { buildOnboardingBillingSummary } from "../../billing/billing-onboarding";
import { validateOnboardingDashboard, validateOnboardingReminders, validateOnboardingStepNavigation } from "../onboarding-validator";
import { ONBOARDING_STEP_IDS } from "../onboarding-types";

describe("onboarding validator", () => {
  it("rejects invalid completion percent", () => {
    const result = validateOnboardingDashboard({
      storeId: "store-1",
      computedAt: new Date().toISOString(),
      aggregationDurationMs: 1,
      demoMode: false,
      activated: false,
      currentStepId: "welcome",
      progress: {
        completionPercent: 150,
        remainingSteps: 0,
        estimatedMinutesRemaining: 0,
        recommendedNextAction: "Continue",
        blockedSteps: [],
        skippedSteps: [],
        lifecycleStage: "installed",
      },
      activationScore: {
        score: 50,
        shopifyConnected: true,
        googleConnected: false,
        productsSynced: false,
        ordersSynced: false,
        aiInitialized: false,
        executiveCooCompleted: false,
        automationReady: false,
        systemHealthy: false,
      },
      steps: [],
      reminders: [],
      executiveBriefing: null,
      demoSnapshot: null,
      emptyStates: {
        noProducts: true,
        noOrders: true,
        noConnectors: true,
        noAiRuns: true,
        noAutomations: true,
        noOperations: true,
      },
      billingSummary: buildOnboardingBillingSummary(),
    });

    expect(result.ok).toBe(false);
  });

  it("validates reminder links stay in app", () => {
    const result = validateOnboardingReminders([
      {
        id: "reminder-1",
        severity: "warning",
        message: "Google Analytics is not connected.",
        href: "/app/onboarding",
        connectorId: "ga4",
      },
    ]);

    expect(result.ok).toBe(true);
  });

  it("blocks skip on required steps", () => {
    const result = validateOnboardingStepNavigation("shopify", false, "skip-step");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("step_not_skippable");
  });

  it("includes all onboarding steps in canonical order", () => {
    expect(ONBOARDING_STEP_IDS[0]).toBe("welcome");
    expect(ONBOARDING_STEP_IDS.at(-1)).toBe("executive_briefing");
    expect(ONBOARDING_STEP_IDS.length).toBe(10);
  });
});
