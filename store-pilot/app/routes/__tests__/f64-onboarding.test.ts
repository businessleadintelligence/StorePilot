import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildOnboardingBillingSummary } from "../../billing/billing-onboarding";
import { loader } from "../app.onboarding";
import { authenticate } from "../../shopify.server";
import { getMerchantOnboardingDashboard } from "../../onboarding/onboarding-service";

vi.mock("../../shopify.server", () => ({
  authenticate: { admin: vi.fn() },
}));

vi.mock("../../db.server", () => ({
  default: {
    store: { findUnique: vi.fn() },
  },
}));

vi.mock("../../onboarding/onboarding-service", () => ({
  getMerchantOnboardingDashboard: vi.fn(),
  serializeMerchantOnboardingForLoader: (dashboard: unknown) => dashboard,
}));

beforeEach(() => vi.clearAllMocks());

describe("Onboarding route", () => {
  it("loads onboarding dashboard without modifying AI platform modules", async () => {
    vi.mocked(authenticate.admin).mockResolvedValue({
      session: { shop: "storepilot-test.myshopify.com" },
    } as never);
    const prisma = (await import("../../db.server")).default;
    vi.mocked(prisma.store.findUnique).mockResolvedValue({ id: "store-test-001" } as never);
    vi.mocked(getMerchantOnboardingDashboard).mockResolvedValue({
      storeId: "store-test-001",
      computedAt: new Date().toISOString(),
      aggregationDurationMs: 20,
      demoMode: false,
      activated: false,
      currentStepId: "welcome",
      progress: {
        completionPercent: 0,
        remainingSteps: 10,
        estimatedMinutesRemaining: 5,
        recommendedNextAction: "Continue with Welcome",
        blockedSteps: [],
        skippedSteps: [],
        lifecycleStage: "installed",
      },
      activationScore: {
        score: 12,
        shopifyConnected: true,
        googleConnected: false,
        productsSynced: false,
        ordersSynced: false,
        aiInitialized: false,
        executiveCooCompleted: false,
        automationReady: false,
        systemHealthy: true,
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

    const data = await loader({ request: new Request("http://localhost/app/onboarding") } as never);

    expect(getMerchantOnboardingDashboard).toHaveBeenCalledWith("store-test-001");
    expect(data.onboardingDashboard?.currentStepId).toBe("welcome");
  });
});
