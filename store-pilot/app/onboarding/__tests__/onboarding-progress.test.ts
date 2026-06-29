import { beforeEach, describe, expect, it } from "vitest";

import { computeOnboardingProgress, getNextOnboardingStepId, isOnboardingStepSkippable } from "../onboarding-progress";
import { buildMerchantOnboardingRecord } from "./helpers";

describe("onboarding progress", () => {
  it("computes completion percent from completed and skipped steps", () => {
    const record = buildMerchantOnboardingRecord({
      completedStepIds: ["welcome", "shopify"],
      skippedStepIds: ["google"],
    });

    const progress = computeOnboardingProgress({
      record,
      stepStatuses: {},
    });

    expect(progress.completionPercent).toBe(30);
    expect(progress.skippedSteps).toContain("google");
  });

  it("returns next incomplete step", () => {
    const record = buildMerchantOnboardingRecord({
      completedStepIds: ["welcome", "shopify"],
    });

    expect(getNextOnboardingStepId(record)).toBe("google");
  });

  it("marks optional connectors as skippable", () => {
    expect(isOnboardingStepSkippable("ga4")).toBe(true);
    expect(isOnboardingStepSkippable("shopify")).toBe(false);
  });

  it("derives lifecycle stage from record", () => {
    const synced = buildMerchantOnboardingRecord({
      completedStepIds: ["welcome", "shopify", "shopify_sync"],
    });

    expect(
      computeOnboardingProgress({ record: synced, stepStatuses: {} }).lifecycleStage,
    ).toBe("synced");
  });
});

describe("onboarding activation scoring inputs", () => {
  it("recommends demo exit when demo mode enabled", () => {
    const progress = computeOnboardingProgress({
      record: buildMerchantOnboardingRecord({ demoMode: true }),
      stepStatuses: {},
    });

    expect(progress.recommendedNextAction).toContain("demo");
  });
});
