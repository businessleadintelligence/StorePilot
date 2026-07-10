import { describe, expect, it } from "vitest";

import { buildDbPlanSeedRecords, buildWebsitePricingModel, getFeatureAvailability, isFeatureAvailable, LEGACY_PLAN_SLUG_MAP, normalizePlanSlug, PLAN_REGISTRY, PUBLIC_PLAN_SLUGS } from "../plan-registry";
import { BILLING_CONFIG, BILLING_PLAN_SLUGS } from "../plan-config";
import { buildPlanDefinition, listCanonicalPlans } from "../billing-limits";
import { validateBillingRegistry } from "../billing-config-validator";

describe("billing unification registry", () => {
  it("exposes exactly three public plans with unified pricing", () => {
    expect(PUBLIC_PLAN_SLUGS).toEqual(["starter", "growth", "scale"]);
    expect(PLAN_REGISTRY.starter.monthlyPriceUsd).toBe(29);
    expect(PLAN_REGISTRY.growth.monthlyPriceUsd).toBe(79);
    expect(PLAN_REGISTRY.scale.monthlyPriceUsd).toBe(199);
  });

  it("maps legacy pro/agency slugs to scale", () => {
    expect(normalizePlanSlug("pro")).toBe("scale");
    expect(normalizePlanSlug("agency")).toBe("scale");
    expect(LEGACY_PLAN_SLUG_MAP.pro).toBe("scale");
  });

  it("derives plan-config from registry without agency/pro", () => {
    expect(BILLING_PLAN_SLUGS).toEqual(["starter", "growth", "scale"]);
    expect(BILLING_CONFIG.plans).not.toHaveProperty("agency");
    expect(BILLING_CONFIG.plans).not.toHaveProperty("pro");
  });

  it("gates prediction workspace to growth+", () => {
    expect(isFeatureAvailable("starter", "prediction_workspace")).toBe(false);
    expect(isFeatureAvailable("growth", "prediction_workspace")).toBe(true);
    expect(isFeatureAvailable("scale", "prediction_workspace")).toBe(true);
  });

  it("gates api access to scale", () => {
    expect(isFeatureAvailable("growth", "api_access")).toBe(false);
    expect(isFeatureAvailable("scale", "api_access")).toBe(true);
  });

  it("provides upgrade availability metadata", () => {
    const availability = getFeatureAvailability("starter", "prediction_engine");
    expect(availability.available).toBe(false);
    expect(availability.minimumPlanName).toBe("Growth");
    expect(availability.upgradeText).toContain("Growth");
  });

  it("builds db seed records from registry only", () => {
    const records = buildDbPlanSeedRecords();
    expect(records.map((r) => r.slug)).toEqual(["starter", "growth", "scale"]);
    expect(records[0]?.monthlyPrice).toBe(29);
    expect(records[2]?.monthlyPrice).toBe(199);
  });

  it("builds website pricing without hardcoded duplicate plans", () => {
    const website = buildWebsitePricingModel();
    expect(website.plans).toHaveLength(3);
    expect(website.plans.map((p) => p.slug)).toEqual(["starter", "growth", "scale"]);
  });

  it("validates registry integrity", () => {
    expect(validateBillingRegistry().ok).toBe(true);
  });

  it("builds canonical plan definitions from registry", () => {
    const plans = listCanonicalPlans();
    expect(plans).toHaveLength(3);
    expect(buildPlanDefinition("scale").name).toBe("Scale");
    expect(buildPlanDefinition("scale").workerQueueTier).toBe("priority");
  });
});
