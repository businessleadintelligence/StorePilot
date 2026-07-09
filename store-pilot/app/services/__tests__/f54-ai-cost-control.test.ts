import { beforeEach, describe, expect, it, vi } from "vitest";

import { BILLING_CONFIG } from "../../billing/plan-config";
import { STORE_ID, seedUsageMetricForTests, testHarness } from "./helpers/fixtures";
import {
  calculatePercentUsed,
  checkAiBudget,
  consumeAiCredits,
  getAiAlertLevel,
  getAiBudgetStatus,
  getAiUsageSummary,
  getAlertLevelForUsage,
} from "../ai-cost-control.server";
import {
  createTrialSubscription,
  getCurrentUsageMonth,
} from "../billing.server";

const STARTER_AI_LIMIT = BILLING_CONFIG.limits.starter.aiExecutions;

beforeEach(() => {
  const harness = testHarness();
  harness.resetDbState();
  vi.clearAllMocks();
});

describe("F.5.4 AI Cost Control Engine", () => {
  it("1. reports warning_80 at 80% of starter budget", async () => {
    await createTrialSubscription(STORE_ID, "starter");
    const used = Math.floor(STARTER_AI_LIMIT * 0.8);
    await seedUsageMetricForTests(STORE_ID, "ai_requests", used, getCurrentUsageMonth());

    const status = await getAiBudgetStatus(STORE_ID);

    expect(status).toMatchObject({
      allowed: true,
      used,
      limit: STARTER_AI_LIMIT,
      remaining: STARTER_AI_LIMIT - used,
      percentUsed: 80,
      alertLevel: "warning_80",
      reason: null,
    });
    expect(await getAiAlertLevel(STORE_ID)).toBe("warning_80");
  });

  it("2. reports warning_90 at 90% of starter budget", async () => {
    await createTrialSubscription(STORE_ID, "starter");
    const used = Math.floor(STARTER_AI_LIMIT * 0.9);
    await seedUsageMetricForTests(STORE_ID, "ai_requests", used, getCurrentUsageMonth());

    const status = await getAiBudgetStatus(STORE_ID);

    expect(status).toMatchObject({
      used,
      percentUsed: 90,
      alertLevel: "warning_90",
    });
  });

  it("3. reports limit_reached at 100% of starter budget", async () => {
    await createTrialSubscription(STORE_ID, "starter");
    await seedUsageMetricForTests(STORE_ID, "ai_requests", STARTER_AI_LIMIT, getCurrentUsageMonth());

    const status = await getAiBudgetStatus(STORE_ID);

    expect(status).toMatchObject({
      allowed: true,
      used: STARTER_AI_LIMIT,
      remaining: 0,
      percentUsed: 100,
      alertLevel: "limit_reached",
    });
  });

  it("4. consumes credits and updates remaining budget", async () => {
    await createTrialSubscription(STORE_ID, "starter");

    const first = await consumeAiCredits(STORE_ID, 25);
    const second = await consumeAiCredits(STORE_ID, 10);

    expect(first).toMatchObject({
      allowed: true,
      consumed: 25,
      used: 25,
      remaining: STARTER_AI_LIMIT - 25,
      reason: null,
    });
    expect(second).toMatchObject({
      allowed: true,
      consumed: 10,
      used: 35,
      remaining: STARTER_AI_LIMIT - 35,
    });
  });

  it("5. blocks consumption when budget would be exceeded", async () => {
    await createTrialSubscription(STORE_ID, "starter");
    await seedUsageMetricForTests(
      STORE_ID,
      "ai_requests",
      STARTER_AI_LIMIT - 5,
      getCurrentUsageMonth(),
    );

    const blocked = await consumeAiCredits(STORE_ID, 10);

    expect(blocked).toMatchObject({
      allowed: false,
      consumed: 0,
      used: STARTER_AI_LIMIT - 5,
      remaining: 5,
      reason: "budget_exceeded",
    });
  });

  it("6. checks estimated credits before allowing AI work", async () => {
    await createTrialSubscription(STORE_ID, "starter");
    const used = STARTER_AI_LIMIT - 5;
    await seedUsageMetricForTests(STORE_ID, "ai_requests", used, getCurrentUsageMonth());

    const allowed = await checkAiBudget(STORE_ID, 2);
    const blocked = await checkAiBudget(STORE_ID, 10);

    expect(allowed.allowed).toBe(true);
    expect(allowed.alertLevel).toBe("warning_90");
    expect(blocked).toMatchObject({
      allowed: false,
      reason: "budget_exceeded",
    });
  });

  it("7. applies growth and agency plan budgets", async () => {
    testHarness().dbState.subscriptions.clear();
    await createTrialSubscription(STORE_ID, "growth");
    const growth = await getAiUsageSummary(STORE_ID);
    expect(growth?.limit).toBe(BILLING_CONFIG.limits.growth.aiExecutions);

    const harness = testHarness();
    harness.dbState.subscriptions.clear();
    await createTrialSubscription(STORE_ID, "agency");
    const agency = await getAiUsageSummary(STORE_ID);
    expect(agency?.limit).toBe(BILLING_CONFIG.limits.agency.aiExecutions);
  });

  it("8. reports blocked AI budget when subscription is missing", async () => {
    const harness = testHarness();
    harness.dbState.subscriptions.clear();

    const summary = await getAiUsageSummary(STORE_ID);

    expect(summary).toMatchObject({
      planSlug: "starter",
      fallbackReason: "subscription_missing",
      limit: STARTER_AI_LIMIT,
      used: 0,
      remaining: 0,
      allowed: false,
      reason: "subscription_missing",
    });
  });

  it("9. ignores negative credit consumption values", async () => {
    await createTrialSubscription(STORE_ID, "starter");

    const result = await consumeAiCredits(STORE_ID, -5);

    expect(result).toMatchObject({
      allowed: true,
      consumed: 0,
      used: 0,
      remaining: STARTER_AI_LIMIT,
    });
  });

  it("10. never throws during budget checks", async () => {
    await expect(getAiBudgetStatus("")).resolves.toMatchObject({
      allowed: false,
      reason: "plan_missing",
    });
    await expect(checkAiBudget(STORE_ID, 1)).resolves.toMatchObject({
      allowed: expect.any(Boolean),
    });
  });

  it("11. includes reports_generated usage in shared AI budget", async () => {
    await createTrialSubscription(STORE_ID, "starter");
    const month = getCurrentUsageMonth();

    await seedUsageMetricForTests(STORE_ID, "reports_generated", 50, month);
    await seedUsageMetricForTests(STORE_ID, "ai_requests", 10, month);

    const status = await getAiBudgetStatus(STORE_ID);

    expect(status.used).toBe(60);
    expect(status.remaining).toBe(STARTER_AI_LIMIT - 60);
  });
});

describe("F.5.4 AI cost control helpers", () => {
  it("calculates alert thresholds deterministically", () => {
    expect(getAlertLevelForUsage(79, 100)).toBe("normal");
    expect(getAlertLevelForUsage(80, 100)).toBe("warning_80");
    expect(getAlertLevelForUsage(90, 100)).toBe("warning_90");
    expect(getAlertLevelForUsage(100, 100)).toBe("limit_reached");
    expect(calculatePercentUsed(25, 100)).toBe(25);
  });
});
