import { beforeEach, describe, expect, it, vi } from "vitest";

import { BILLING_CONFIG } from "../../billing/plan-config";
import { STORE_ID, seedUsageMetricForTests, testHarness } from "./helpers/fixtures";
import { consumeAiCredits, getAiBudgetStatus } from "../ai-cost-control.server";
import {
  createTrialSubscription,
  getCurrentMonthUsage,
  getCurrentUsageMonth,
} from "../billing.server";

const STARTER_AI_LIMIT = BILLING_CONFIG.limits.starter.aiExecutions;

beforeEach(() => {
  const harness = testHarness();
  harness.resetDbState();
  vi.clearAllMocks();
});

describe("F.6.0A FIX2 Issue 2 — AI budget race prevention", () => {
  it("allows only one concurrent debit when usage is near limit and two requests consume 5", async () => {
    await createTrialSubscription(STORE_ID, "starter");
    const month = getCurrentUsageMonth();
    seedUsageMetricForTests(STORE_ID, "ai_requests", STARTER_AI_LIMIT - 5, month);

    const [first, second] = await Promise.all([
      consumeAiCredits(STORE_ID, 5),
      consumeAiCredits(STORE_ID, 5),
    ]);

    const successes = [first, second].filter((result) => result.consumed === 5);
    const blocked = [first, second].filter((result) => result.consumed === 0);

    expect(successes).toHaveLength(1);
    expect(blocked).toHaveLength(1);
    expect(blocked[0]?.reason).toBe("budget_exceeded");

    const usage = await getCurrentMonthUsage(STORE_ID, month);
    expect(usage.ai_requests).toBe(STARTER_AI_LIMIT);

    const status = await getAiBudgetStatus(STORE_ID);
    expect(status.used).toBe(STARTER_AI_LIMIT);
    expect(status.remaining).toBe(0);
  });

  it("blocks all concurrent debits when budget is already exhausted", async () => {
    await createTrialSubscription(STORE_ID, "starter");
    seedUsageMetricForTests(STORE_ID, "ai_requests", STARTER_AI_LIMIT, getCurrentUsageMonth());

    const results = await Promise.all([
      consumeAiCredits(STORE_ID, 1),
      consumeAiCredits(STORE_ID, 1),
      consumeAiCredits(STORE_ID, 1),
    ]);

    expect(results.every((result) => result.consumed === 0)).toBe(true);
    expect(
      (await getCurrentMonthUsage(STORE_ID, getCurrentUsageMonth())).ai_requests,
    ).toBe(STARTER_AI_LIMIT);
  });
});
