import { beforeEach, describe, expect, it, vi } from "vitest";

import { STORE_ID, testHarness } from "./helpers/fixtures";
import * as aiCostControl from "../ai-cost-control.server";
import { consumeAiCredits } from "../ai-cost-control.server";
import {
  createTrialSubscription,
  getCurrentUsageMonth,
  recordUsage,
} from "../billing.server";
import * as billingModule from "../billing.server";
import { recordUsageIfAllowed } from "../entitlements.server";

beforeEach(() => {
  const harness = testHarness();
  harness.resetDbState();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("F.6.0A FIX2 Issue 1 — AI credit bypass prevention", () => {
  it("blocks direct recordUsage writes for ai_requests", async () => {
    const month = getCurrentUsageMonth();
    const record = await recordUsage(STORE_ID, "ai_requests", 10, month);

    expect(record).toBeNull();
  });

  it("routes recordUsageIfAllowed ai_requests through consumeAiCredits", async () => {
    await createTrialSubscription(STORE_ID, "starter");

    const consumeSpy = vi.spyOn(aiCostControl, "consumeAiCredits");

    const result = await recordUsageIfAllowed(STORE_ID, "ai_requests", 3);

    expect(consumeSpy).toHaveBeenCalledWith(STORE_ID, 3);
    expect(result.recorded).toBe(true);
    expect(result.allowed).toBe(true);
  });

  it("returns blocked entitlements result when consumeAiCredits rejects debit", async () => {
    await createTrialSubscription(STORE_ID, "starter");

    vi.spyOn(aiCostControl, "consumeAiCredits").mockResolvedValue({
      allowed: false,
      used: 100,
      remaining: 0,
      limit: 100,
      percentUsed: 100,
      alertLevel: "limit_reached",
      reason: "budget_exceeded",
      consumed: 0,
    });

    const result = await recordUsageIfAllowed(STORE_ID, "ai_requests", 1);

    expect(result).toMatchObject({
      allowed: false,
      recorded: false,
      reason: "limit_exceeded",
    });
  });

  it("blocks direct recordUsage writes for reports_generated", async () => {
    const month = getCurrentUsageMonth();
    const record = await recordUsage(STORE_ID, "reports_generated", 10, month);

    expect(record).toBeNull();
  });

  it("does not expose incrementUsageRecord as a public billing API", () => {
    expect(billingModule).not.toHaveProperty("incrementUsageRecord");
  });

  it("allows non-ai metrics through recordUsage", async () => {
    const month = getCurrentUsageMonth();
    const record = await recordUsage(STORE_ID, "orders", 7, month);

    expect(record?.value).toBe(7);
  });

  it("only increments ai_requests through consumeAiCredits", async () => {
    await createTrialSubscription(STORE_ID, "starter");

    const consumed = await consumeAiCredits(STORE_ID, 12);

    expect(consumed.consumed).toBe(12);
    expect(consumed.used).toBe(12);
  });
});
