import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";

import { buildOnboardingBillingSummary } from "../../../billing/billing-onboarding";
import { OnboardingWizard } from "../OnboardingWizard";
import { ONBOARDING_STEP_DEFINITIONS, type OnboardingStepStatus } from "../../../onboarding/onboarding-types";

describe("Onboarding Wizard component", () => {
  it("renders setup sections and accessibility landmarks", () => {
    const html = renderToString(
      createElement(OnboardingWizard, {
        dashboard: {
          storeId: "store-test-001",
          computedAt: new Date().toISOString(),
          aggregationDurationMs: 12,
          demoMode: false,
          activated: false,
          currentStepId: "welcome",
          progress: {
            completionPercent: 10,
            remainingSteps: 9,
            estimatedMinutesRemaining: 4,
            recommendedNextAction: "Continue with Welcome",
            blockedSteps: [],
            skippedSteps: [],
            lifecycleStage: "installed",
          },
          activationScore: {
            score: 25,
            shopifyConnected: true,
            googleConnected: false,
            productsSynced: false,
            ordersSynced: false,
            aiInitialized: false,
            executiveCooCompleted: false,
            automationReady: false,
            systemHealthy: false,
          },
          steps: ONBOARDING_STEP_DEFINITIONS.map((step) => ({
            id: step.id,
            label: step.label,
            description: step.description,
            status: (step.id === "welcome" ? "in_progress" : "pending") as OnboardingStepStatus,
            required: step.required,
            skippable: step.skippable,
            estimatedMinutes: step.estimatedMinutes,
            healthLabel: null,
            summary: null,
            warning: null,
            details: {},
          })),
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
        },
      }),
    );

    expect(html).toContain("StorePilot Setup");
    expect(html).toContain("Privacy-by-Architecture");
    expect(html).toContain("Demo mode");
    expect(html).toContain("All steps");
  });
});
