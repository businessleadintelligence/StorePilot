import { beforeEach, describe, expect, it, vi } from "vitest";

import { BILLING_CONFIG } from "../../billing/plan-config";
import { getResolvedPlanLimit } from "../../billing/plan-registry";
import { STORE_ID, seedUsageMetricForTests, testHarness } from "./helpers/fixtures";
import {
  DEFAULT_TRIAL_DAYS,
  addDays,
  createTrialSubscription,
  getCurrentMonthUsage,
  getCurrentUsageMonth,
  getStorePlan,
  getStoreSubscription,
  recordUsage,
} from "../billing.server";

beforeEach(() => {
  const harness = testHarness();
  harness.resetDbState();
  vi.clearAllMocks();
});

describe("F.5.2 Billing Foundation", () => {
  it("1. seeds starter, growth, and scale plans", () => {
    const harness = testHarness();
    const plans = [...harness.dbState.plans.values()].filter((plan) => plan.active);

    expect(plans).toHaveLength(3);
    expect(plans.map((plan) => plan.slug).sort()).toEqual(["growth", "scale", "starter"]);

    const starter = plans.find((plan) => plan.slug === "starter");
    expect(starter).toMatchObject({
      name: "Starter",
      monthlyPrice: BILLING_CONFIG.plans.starter.price,
      annualPrice: BILLING_CONFIG.plans.starter.price * 10,
      active: true,
    });
  });

  it("2. creates a trialing starter subscription", async () => {
    const before = Date.now();
    const subscription = await createTrialSubscription(STORE_ID);

    expect(subscription).not.toBeNull();
    expect(subscription?.status).toBe("trialing");
    expect(subscription?.plan.slug).toBe("starter");
    expect(subscription?.plan.monthlyPrice).toBe(BILLING_CONFIG.plans.starter.price);
    expect(subscription?.trialEndsAt).not.toBeNull();

    const trialEndsAt = subscription!.trialEndsAt!.getTime();
    const expectedEnd = addDays(new Date(before), DEFAULT_TRIAL_DAYS).getTime();
    expect(Math.abs(trialEndsAt - expectedEnd)).toBeLessThan(5_000);
    expect(subscription?.currentPeriodEnd.getTime()).toBe(trialEndsAt);
  });

  it("3. returns existing subscription instead of creating duplicates", async () => {
    const first = await createTrialSubscription(STORE_ID);
    const second = await createTrialSubscription(STORE_ID);

    expect(second?.id).toBe(first?.id);
    expect(testHarness().dbState.subscriptions.size).toBe(1);
  });

  it("4. loads store subscription and plan", async () => {
    await createTrialSubscription(STORE_ID);

    const subscription = await getStoreSubscription(STORE_ID);
    const plan = await getStorePlan(STORE_ID);

    expect(subscription?.storeId).toBe(STORE_ID);
    expect(subscription?.plan.slug).toBe("starter");
    expect(plan).toEqual(subscription?.plan);
  });

  it("5. records and increments monthly usage", async () => {
    const month = getCurrentUsageMonth();

    const first = await recordUsage(STORE_ID, "products", 5, month);
    const second = await recordUsage(STORE_ID, "products", 3, month);

    expect(first?.value).toBe(5);
    expect(second?.value).toBe(8);

    const usage = await getCurrentMonthUsage(STORE_ID, month);
    expect(usage.products).toBe(8);
    expect(usage.orders).toBe(0);
    expect(usage.ai_requests).toBe(0);
    expect(usage.reports_generated).toBe(0);
  });

  it("6. tracks multiple usage metrics for the current month", async () => {
    const month = getCurrentUsageMonth();

    await recordUsage(STORE_ID, "orders", 12, month);
    seedUsageMetricForTests(STORE_ID, "ai_requests", 4, month);
    seedUsageMetricForTests(STORE_ID, "reports_generated", 2, month);

    const usage = await getCurrentMonthUsage(STORE_ID, month);

    expect(usage).toEqual({
      products: 0,
      orders: 12,
      ai_requests: 4,
      reports_generated: 2,
    });
  });

  it("7. returns null subscription when store has no billing record", async () => {
    testHarness().dbState.subscriptions.clear();

    expect(await getStoreSubscription(STORE_ID)).toBeNull();
    expect(await getStorePlan(STORE_ID)).toBeNull();
  });

  it("8. creates trial on growth plan when slug is provided", async () => {
    testHarness().dbState.subscriptions.clear();
    const subscription = await createTrialSubscription(STORE_ID, "growth");

    expect(subscription?.plan.slug).toBe("growth");
    expect(subscription?.plan.monthlyPrice).toBe(BILLING_CONFIG.plans.growth.price);
    expect(subscription?.plan.maxTeamMembers).toBe(getResolvedPlanLimit("growth", "users"));
  });

  it("9. ignores negative usage values", async () => {
    const month = getCurrentUsageMonth();
    const record = await recordUsage(STORE_ID, "products", -10, month);

    expect(record?.value).toBe(0);
  });

  it("10. rejects direct ai_requests usage writes", async () => {
    const month = getCurrentUsageMonth();
    const record = await recordUsage(STORE_ID, "ai_requests", 5, month);

    expect(record).toBeNull();
    expect((await getCurrentMonthUsage(STORE_ID, month)).ai_requests).toBe(0);
  });
});
