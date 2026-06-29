import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleOnboardingAction } from "../onboarding-actions";
import { clearOnboardingPersistence, createInMemoryOnboardingPersistence } from "../onboarding-persistence";
import { buildMerchantOnboardingRecord, STORE_ID } from "./helpers";

vi.mock("../../services/google-integration.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/google-integration.server")>();
  return {
    ...actual,
    beginGoogleOAuth: vi.fn(async () => "https://accounts.google.com/o/oauth2/auth"),
    skipGoogleAnalyticsOnboarding: vi.fn(async () => undefined),
    syncGoogleAnalyticsForStore: vi.fn(async () => undefined),
    syncGoogleSearchConsoleForStore: vi.fn(async () => undefined),
    syncGooglePageSpeedForStore: vi.fn(async () => undefined),
  };
});

vi.mock("../../services/onboarding.server", () => ({
  advanceOnboarding: vi.fn(async () => ({ action: "enqueued" })),
  resumeOnboarding: vi.fn(async () => ({ action: "resumed" })),
}));

const persistence = createInMemoryOnboardingPersistence();

beforeEach(async () => {
  vi.clearAllMocks();
  clearOnboardingPersistence();
  await persistence.save(buildMerchantOnboardingRecord());
});

describe("onboarding actions", () => {
  it("completes welcome step", async () => {
    const result = await handleOnboardingAction({
      storeId: STORE_ID,
      shop: "demo.myshopify.com",
      intent: "complete-welcome",
      persistence,
    });

    expect(result.ok).toBe(true);
    const record = await persistence.load(STORE_ID);
    expect(record.completedStepIds).toContain("welcome");
  });

  it("skips optional ga4 step", async () => {
    const result = await handleOnboardingAction({
      storeId: STORE_ID,
      shop: "demo.myshopify.com",
      intent: "skip-step",
      stepId: "ga4",
      persistence,
    });

    expect(result.ok).toBe(true);
    const record = await persistence.load(STORE_ID);
    expect(record.skippedStepIds).toContain("ga4");
  });

  it("rejects skip on required shopify step", async () => {
    const result = await handleOnboardingAction({
      storeId: STORE_ID,
      shop: "demo.myshopify.com",
      intent: "skip-step",
      stepId: "shopify",
      persistence,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("step_not_skippable");
  });

  it("toggles demo mode", async () => {
    await handleOnboardingAction({
      storeId: STORE_ID,
      shop: "demo.myshopify.com",
      intent: "enter-demo",
      persistence,
    });

    let record = await persistence.load(STORE_ID);
    expect(record.demoMode).toBe(true);

    await handleOnboardingAction({
      storeId: STORE_ID,
      shop: "demo.myshopify.com",
      intent: "exit-demo",
      persistence,
    });

    record = await persistence.load(STORE_ID);
    expect(record.demoMode).toBe(false);
  });

  it("returns oauth redirect url", async () => {
    const result = await handleOnboardingAction({
      storeId: STORE_ID,
      shop: "demo.myshopify.com",
      intent: "begin-google-oauth",
      persistence,
    });

    expect(result.redirectTo).toContain("accounts.google.com");
  });
});
