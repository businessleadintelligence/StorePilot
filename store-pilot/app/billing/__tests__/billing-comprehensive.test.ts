import { beforeEach, describe, expect, it } from "vitest";

import { enforceBillingAction } from "../billing-engine";
import { getCanonicalPlan, listCanonicalPlans } from "../billing-limits";
import { clearBillingUsage, incrementBillingUsage } from "../billing-usage";
import { validateBillingDashboard, validateBillingPlanSlug } from "../billing-validator";
import { buildBillingDashboard } from "../billing-dashboard";
import { BILLING_CONFIG, BILLING_PLAN_SLUGS } from "../plan-config";
import { createTrialSubscription } from "../../services/billing.server";
import { STORE_ID, testHarness } from "../../services/__tests__/helpers/fixtures";

beforeEach(() => {
  testHarness().resetDbState();
  clearBillingUsage();
});

describe("commercial billing plans", () => {
  it("uses App Store consistent pricing from plan-config", () => {
    for (const slug of BILLING_PLAN_SLUGS) {
      expect(getCanonicalPlan(slug).monthlyPriceUsd).toBe(BILLING_CONFIG.plans[slug].price);
    }
    expect(listCanonicalPlans()).toHaveLength(BILLING_PLAN_SLUGS.length);
  });

  it("validates plan slugs", () => {
    expect(validateBillingPlanSlug("growth")).toBe(true);
    expect(validateBillingPlanSlug("enterprise")).toBe(false);
  });
});

describe("billing enforcement", () => {
  it("blocks automation on starter plan with upgrade message", async () => {
    await createTrialSubscription(STORE_ID, "starter");

    const result = await enforceBillingAction(STORE_ID, "automation_create", 1);

    expect(result.allowed).toBe(false);
    expect(result.upgradeMessage).toContain("Growth");
  });

  it("blocks when commercial usage limit exceeded", async () => {
    await createTrialSubscription(STORE_ID, "starter");
    const limit = getCanonicalPlan("starter").connectorSyncsPerMonth;

    for (let index = 0; index < limit; index += 1) {
      await incrementBillingUsage(STORE_ID, "connector_sync", 1);
    }

    const result = await enforceBillingAction(STORE_ID, "connector_sync", 1);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("limit_exceeded");
    expect(result.upgradeMessage).toBeTruthy();
  });
});

describe("billing dashboard", () => {
  it("builds merchant-safe billing dashboard", async () => {
    testHarness().dbState.subscriptions.clear();
    await createTrialSubscription(STORE_ID, "growth");
    const dashboard = await buildBillingDashboard(STORE_ID);

    expect(dashboard.currentPlan.monthlyPriceUsd).toBe(BILLING_CONFIG.plans.growth.price);
    expect(
      dashboard.plans.every(
        (plan) => plan.monthlyPriceUsd === BILLING_CONFIG.plans[plan.slug].price,
      ),
    ).toBe(true);

    const validation = validateBillingDashboard(dashboard);
    expect(validation.ok).toBe(true);
  });
});
