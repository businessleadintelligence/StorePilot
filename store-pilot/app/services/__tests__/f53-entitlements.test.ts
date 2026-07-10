import { beforeEach, describe, expect, it, vi } from "vitest";

import { BILLING_CONFIG } from "../../billing/plan-config";
import { getResolvedPlanLimit } from "../../billing/plan-registry";
import { STORE_ID, seedUsageMetricForTests, testHarness } from "./helpers/fixtures";
import {
  createTrialSubscription,
  getCurrentUsageMonth,
} from "../billing.server";
import {
  checkUsageLimit,
  getStoreEntitlements,
  getUsageSummary,
  recordUsageIfAllowed,
} from "../entitlements.server";

const STARTER_AI_LIMIT = BILLING_CONFIG.limits.starter.aiExecutions;
const GROWTH_AI_LIMIT = BILLING_CONFIG.limits.growth.aiExecutions;
const STARTER_PRODUCT_LIMIT = getResolvedPlanLimit("starter", "products");
const GROWTH_PRODUCT_LIMIT = getResolvedPlanLimit("growth", "products");
const STARTER_USER_LIMIT = getResolvedPlanLimit("starter", "users");

beforeEach(() => {
  const harness = testHarness();
  harness.resetDbState();
  vi.clearAllMocks();
});

function seedProducts(count: number) {
  const harness = testHarness();

  for (let index = 0; index < count; index += 1) {
    harness.seedProduct({
      shopifyVariantId: `gid://shopify/ProductVariant/ent-${index}`,
    });
  }
}

function seedOrders(count: number) {
  const harness = testHarness();

  for (let index = 0; index < count; index += 1) {
    harness.seedOrder({
      shopifyOrderId: `gid://shopify/Order/ent-${index}`,
    });
  }
}

describe("F.5.3 Entitlements Engine", () => {
  it("1. returns starter entitlements when subscription is missing", async () => {
    testHarness().dbState.subscriptions.clear();

    const entitlements = await getStoreEntitlements(STORE_ID);

    expect(entitlements).toMatchObject({
      storeId: STORE_ID,
      planSlug: "starter",
      planName: "Starter",
      subscriptionStatus: null,
      fallbackReason: "subscription_missing",
      limits: {
        products: STARTER_PRODUCT_LIMIT,
        orders: STARTER_PRODUCT_LIMIT,
        aiCreditsPerMonth: STARTER_AI_LIMIT,
        maxTeamMembers: STARTER_USER_LIMIT,
      },
    });
  });

  it("2. enforces starter product limits", async () => {
    await createTrialSubscription(STORE_ID, "starter");
    seedProducts(STARTER_PRODUCT_LIMIT);

    const atLimit = await checkUsageLimit(STORE_ID, "products", 0);
    const overLimit = await checkUsageLimit(STORE_ID, "products", 1);

    expect(atLimit).toMatchObject({
      allowed: true,
      used: STARTER_PRODUCT_LIMIT,
      limit: STARTER_PRODUCT_LIMIT,
      remaining: 0,
      reason: null,
    });
    expect(overLimit).toMatchObject({
      allowed: false,
      reason: "limit_exceeded",
    });
  });

  it("3. applies higher growth limits than starter", async () => {
    testHarness().dbState.subscriptions.clear();
    await createTrialSubscription(STORE_ID, "growth");
    seedProducts(1500);

    const growthCheck = await checkUsageLimit(STORE_ID, "products", 0);
    const starterEntitlements = await getStoreEntitlements(STORE_ID);

    expect(growthCheck.allowed).toBe(true);
    expect(growthCheck.limit).toBe(GROWTH_PRODUCT_LIMIT);
    expect(growthCheck.remaining).toBe(GROWTH_PRODUCT_LIMIT - 1500);
    expect(starterEntitlements?.fallbackReason).toBeNull();
    expect(starterEntitlements?.limits.products).toBe(GROWTH_PRODUCT_LIMIT);
  });

  it("4. calculates remaining product capacity before the limit", async () => {
    await createTrialSubscription(STORE_ID, "starter");
    seedProducts(997);

    const check = await checkUsageLimit(STORE_ID, "products", 0);

    expect(check).toMatchObject({
      allowed: true,
      used: 997,
      limit: STARTER_PRODUCT_LIMIT,
      remaining: STARTER_PRODUCT_LIMIT - 997,
      reason: null,
    });
  });

  it("5. blocks AI usage when shared credits are exhausted", async () => {
    await createTrialSubscription(STORE_ID, "starter");
    const month = getCurrentUsageMonth();

    await seedUsageMetricForTests(STORE_ID, "ai_requests", STARTER_AI_LIMIT - 30, month);
    await seedUsageMetricForTests(STORE_ID, "reports_generated", 30, month);

    const aiCheck = await checkUsageLimit(STORE_ID, "ai_requests", 1);
    const reportCheck = await checkUsageLimit(STORE_ID, "reports_generated", 1);

    expect(aiCheck).toMatchObject({
      allowed: false,
      used: STARTER_AI_LIMIT,
      limit: STARTER_AI_LIMIT,
      remaining: 0,
      reason: "limit_exceeded",
    });
    expect(reportCheck.reason).toBe("limit_exceeded");
  });

  it("6. records AI usage only when credits remain", async () => {
    await createTrialSubscription(STORE_ID, "starter");
    const month = getCurrentUsageMonth();

    await seedUsageMetricForTests(STORE_ID, "ai_requests", STARTER_AI_LIMIT - 1, month);

    const allowed = await recordUsageIfAllowed(STORE_ID, "ai_requests", 1);
    const blocked = await recordUsageIfAllowed(STORE_ID, "ai_requests", 1);

    expect(allowed).toMatchObject({
      allowed: true,
      recorded: true,
      used: STARTER_AI_LIMIT,
      remaining: 0,
      reason: null,
    });
    expect(blocked).toMatchObject({
      allowed: false,
      recorded: false,
      reason: "limit_exceeded",
    });
  });

  it("7. enforces order limits from synced order counts", async () => {
    await createTrialSubscription(STORE_ID, "starter");
    seedOrders(5000);

    const check = await checkUsageLimit(STORE_ID, "orders", 1);

    expect(check).toMatchObject({
      allowed: false,
      used: 5000,
      limit: 5000,
      remaining: 0,
      reason: "limit_exceeded",
    });
  });

  it("8. returns usage summary with zero usage when records are missing", async () => {
    testHarness().dbState.subscriptions.clear();
    await createTrialSubscription(STORE_ID, "growth");

    const summary = await getUsageSummary(STORE_ID);

    expect(summary).toMatchObject({
      storeId: STORE_ID,
      products: {
        allowed: true,
        used: 0,
        limit: GROWTH_PRODUCT_LIMIT,
        remaining: GROWTH_PRODUCT_LIMIT,
        reason: null,
      },
      orders: {
        allowed: true,
        used: 0,
        limit: 50000,
        remaining: 50000,
        reason: null,
      },
      sharedAiCredits: {
        limit: GROWTH_AI_LIMIT,
        used: 0,
        remaining: GROWTH_AI_LIMIT,
      },
    });
  });

  it("9. falls back to plan_missing when starter plan is unavailable", async () => {
    const harness = testHarness();
    harness.dbState.plans.clear();
    harness.dbState.plansBySlug.clear();

    const entitlements = await getStoreEntitlements(STORE_ID);
    const check = await checkUsageLimit(STORE_ID, "products", 1);

    expect(entitlements?.fallbackReason).toBe("plan_missing");
    expect(check).toMatchObject({
      allowed: false,
      reason: "plan_missing",
      limit: 0,
      used: 0,
      remaining: 0,
    });
  });

  it("10. never throws during limit checks", async () => {
    await expect(checkUsageLimit("", "products", 1)).resolves.toMatchObject({
      allowed: false,
      reason: "plan_missing",
    });
    await expect(
      recordUsageIfAllowed(STORE_ID, "ai_requests", 1),
    ).resolves.toMatchObject({
      allowed: expect.any(Boolean),
      recorded: expect.any(Boolean),
    });
  });

  it("11. exposes merchant-safe entitlement responses only", async () => {
    await createTrialSubscription(STORE_ID, "starter");
    seedProducts(STARTER_PRODUCT_LIMIT);

    const summary = await getUsageSummary(STORE_ID);
    const serialized = JSON.stringify(summary);

    expect(serialized).not.toMatch(/graphql/i);
    expect(serialized).not.toMatch(/prisma/i);
    expect(serialized).not.toMatch(/worker/i);
    expect(serialized).not.toMatch(/stack/i);
    expect(serialized).not.toMatch(/exception/i);
  });
});

describe("F.5.3 Entitlement boundary conditions", () => {
  it("allows usage exactly at the shared AI credit limit with zero increment", async () => {
    await createTrialSubscription(STORE_ID, "starter");
    const month = getCurrentUsageMonth();
    await seedUsageMetricForTests(STORE_ID, "ai_requests", STARTER_AI_LIMIT, month);

    const check = await checkUsageLimit(STORE_ID, "ai_requests", 0);

    expect(check).toMatchObject({
      allowed: true,
      used: STARTER_AI_LIMIT,
      limit: STARTER_AI_LIMIT,
      remaining: 0,
      reason: null,
    });
  });

  it("allows one remaining AI credit and blocks the next request", async () => {
    await createTrialSubscription(STORE_ID, "starter");
    const month = getCurrentUsageMonth();
    await seedUsageMetricForTests(STORE_ID, "ai_requests", STARTER_AI_LIMIT - 1, month);

    const lastCredit = await checkUsageLimit(STORE_ID, "ai_requests", 1);
    expect(lastCredit.allowed).toBe(true);

    await recordUsageIfAllowed(STORE_ID, "ai_requests", 1);

    const exceeded = await checkUsageLimit(STORE_ID, "reports_generated", 1);

    expect(exceeded.allowed).toBe(false);
    expect(exceeded.reason).toBe("limit_exceeded");
  });
});
