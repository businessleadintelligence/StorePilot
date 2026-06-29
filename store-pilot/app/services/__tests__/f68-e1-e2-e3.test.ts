import { beforeEach, describe, expect, it, vi } from "vitest";

import { SHOP, STORE_ID, testHarness } from "./helpers/fixtures";
import { getAiBudgetStatus } from "../ai-cost-control.server";
import * as billingModule from "../billing.server";
import { createTrialSubscription } from "../billing.server";
import { handleShopRedactWebhook } from "../gdpr.server";
import { checkUsageLimit, recordUsageIfAllowed } from "../entitlements.server";
import {
  normalizeWebhookVariantRow,
  upsertVariantRow,
} from "../product.server";
import {
  serializeOnboardingForLoader,
  shouldShowOnboardingCardFromLoader,
} from "../onboarding-ui.server";
import {
  getSubscriptionAccessState,
  getSubscriptionStatusSummary,
} from "../subscription.server";
import { handleAppUninstalledWebhook } from "../store.server";
import {
  buildWebhookCatchResponse,
  isRetriableWebhookError,
} from "../webhook.server";
import * as webhookServer from "../webhook.server";

function buildShopRedactPayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    shop_id: 954889,
    shop_domain: SHOP,
    ...overrides,
  };
}

beforeEach(() => {
  const harness = testHarness();
  harness.resetDbState();
  vi.clearAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("F.6.8 E1.1 GDPR shop redact hardening", () => {
  it("1. first execution deletes all merchant-owned store data", async () => {
    const harness = testHarness();
    harness.seedProduct({ shopifyVariantId: "gid://shopify/ProductVariant/gdpr-1" });
    harness.seedOrder({ shopifyOrderId: "gid://shopify/Order/gdpr-1" });
    await createTrialSubscription(STORE_ID, "starter");
    harness.dbState.sessions.push({ id: "session-gdpr", shop: SHOP });

    const result = await handleShopRedactWebhook({
      shop: SHOP,
      topic: "shop/redact",
      webhookId: "wh-f68-gdpr-first",
      payload: buildShopRedactPayload(),
    });

    expect(result.action).toBe("shop_redacted");
    expect(harness.dbState.stores).toHaveLength(0);
    expect(harness.dbState.products.size).toBe(0);
    expect(harness.dbState.orders.size).toBe(0);
    expect(harness.dbState.subscriptions.size).toBe(0);
    expect(harness.dbState.sessions).toHaveLength(0);
  });

  it("2. repeated execution is idempotent when store is already deleted", async () => {
    const first = await handleShopRedactWebhook({
      shop: SHOP,
      topic: "shop/redact",
      webhookId: "wh-f68-gdpr-repeat-1",
      payload: buildShopRedactPayload(),
    });
    expect(first.action).toBe("shop_redacted");

    const second = await handleShopRedactWebhook({
      shop: SHOP,
      topic: "shop/redact",
      webhookId: "wh-f68-gdpr-repeat-2",
      payload: buildShopRedactPayload(),
    });

    expect(second).toEqual({
      success: true,
      action: "store_not_found",
    });
  });

  it("3. missing store still clears sessions and succeeds", async () => {
    const harness = testHarness();
    harness.dbState.stores.length = 0;
    harness.dbState.sessions.push({ id: "session-missing", shop: SHOP });

    const result = await handleShopRedactWebhook({
      shop: SHOP,
      topic: "shop/redact",
      webhookId: "wh-f68-gdpr-missing",
      payload: buildShopRedactPayload(),
    });

    expect(result.action).toBe("store_not_found");
    expect(harness.dbState.sessions).toHaveLength(0);
  });

  it("4. partially deleted store with remaining products still completes deletion", async () => {
    const harness = testHarness();
    harness.seedProduct({ shopifyVariantId: "gid://shopify/ProductVariant/partial-1" });
    harness.dbState.products.clear();

    const result = await handleShopRedactWebhook({
      shop: SHOP,
      topic: "shop/redact",
      webhookId: "wh-f68-gdpr-partial",
      payload: buildShopRedactPayload(),
    });

    expect(result.action).toBe("shop_redacted");
    expect(harness.dbState.stores).toHaveLength(0);
  });
});

describe("F.6.8 E1.2 uninstall reliability", () => {
  it("1. deactivates store and clears sessions on success", async () => {
    const harness = testHarness();
    harness.dbState.sessions.push({ id: "session-uninstall", shop: SHOP });

    const result = await handleAppUninstalledWebhook({
      shop: SHOP,
      topic: "app/uninstalled",
      webhookId: "wh-f68-uninstall-1",
    });

    expect(result).toEqual({ success: true });
    expect(harness.getStore().active).toBe(false);
    expect(harness.getStore().accessToken).toBe("");
    expect(harness.dbState.sessions).toHaveLength(0);
  });

  it("2. duplicate delivery is idempotent", async () => {
    const processedEvent = {
      id: "event-uninstall-dup",
      storeId: STORE_ID,
      shopifyWebhookId: "wh-f68-uninstall-dup",
      shop: SHOP,
      topic: "app/uninstalled",
      processedSuccessfully: true,
      processedAt: new Date(),
      createdAt: new Date(),
    };
    testHarness().dbState.webhookEvents.set(
      "wh-f68-uninstall-dup",
      processedEvent,
    );
    testHarness().dbState.webhookEventsById.set(
      "event-uninstall-dup",
      processedEvent,
    );

    const result = await handleAppUninstalledWebhook({
      shop: SHOP,
      topic: "app/uninstalled",
      webhookId: "wh-f68-uninstall-dup",
    });

    expect(result).toEqual({ success: true, duplicate: true });
  });

  it("3. transient DB failure returns retryable result", async () => {
    const harness = testHarness();
    harness.prismaMock.store.update.mockRejectedValueOnce(
      new Error("retriable_db_unavailable"),
    );

    const result = await handleAppUninstalledWebhook({
      shop: SHOP,
      topic: "app/uninstalled",
      webhookId: "wh-f68-uninstall-fail",
    });

    expect(result).toEqual({
      success: false,
      retryable: true,
      reason: "retriable_db_unavailable",
    });
  });

  it("4. retryable handler result maps to HTTP 503", async () => {
    const response = buildWebhookCatchResponse(new Error("graphql_down"));
    expect(response.status).toBe(503);
  });
});

describe("F.6.8 E2 subscription lifecycle", () => {
  async function seedSubscriptionStatus(
    status: "trialing" | "active" | "cancelled" | "past_due",
    trialEndsAt: Date | null = new Date(Date.now() + 86_400_000),
  ) {
    const harness = testHarness();
    await createTrialSubscription(STORE_ID, "starter");
    const subscription = harness.dbState.subscriptions.get(STORE_ID);
    if (!subscription) {
      throw new Error("subscription_missing");
    }

    subscription.status = status;
    subscription.trialEndsAt = trialEndsAt;
    harness.dbState.subscriptions.set(STORE_ID, subscription);
  }

  it("1. createTrialSubscription is idempotent", async () => {
    const first = await createTrialSubscription(STORE_ID, "starter");
    const second = await createTrialSubscription(STORE_ID, "starter");

    expect(first?.id).toBe(second?.id);
    expect(testHarness().dbState.subscriptions.size).toBe(1);
  });

  it("2. trialing and active subscriptions are allowed", async () => {
    await seedSubscriptionStatus("trialing");
    expect(await getSubscriptionAccessState(STORE_ID)).toEqual({
      accessState: "allowed",
      reason: "trialing",
    });

    await seedSubscriptionStatus("active");
    expect(await getSubscriptionAccessState(STORE_ID)).toEqual({
      accessState: "allowed",
      reason: "active",
    });
  });

  it("3. cancelled, past_due, and expired trial block entitlements", async () => {
    await seedSubscriptionStatus("cancelled");
    expect(await checkUsageLimit(STORE_ID, "products", 1)).toMatchObject({
      allowed: false,
      reason: "subscription_inactive",
    });

    await seedSubscriptionStatus("past_due");
    expect(await checkUsageLimit(STORE_ID, "orders", 1)).toMatchObject({
      allowed: false,
      reason: "subscription_inactive",
    });

    await seedSubscriptionStatus(
      "trialing",
      new Date(Date.now() - 86_400_000),
    );
    expect(await checkUsageLimit(STORE_ID, "ai_requests", 1)).toMatchObject({
      allowed: false,
      reason: "subscription_inactive",
    });
  });

  it("4. subscription health helpers expose merchant-safe access state", async () => {
    await seedSubscriptionStatus("past_due");

    const summary = await getSubscriptionStatusSummary(STORE_ID);

    expect(summary).toMatchObject({
      status: "past_due",
      planSlug: "starter",
      accessState: "blocked",
      accessReason: "past_due",
    });
    expect(summary.trialEndsAt).toEqual(expect.any(String));
  });

  it("5. blocked subscriptions also block AI budget and report usage", async () => {
    await seedSubscriptionStatus("cancelled");

    const aiBudget = await getAiBudgetStatus(STORE_ID);
    expect(aiBudget).toMatchObject({
      allowed: false,
      reason: "subscription_inactive",
    });

    const reports = await recordUsageIfAllowed(
      STORE_ID,
      "reports_generated",
      1,
    );
    expect(reports).toMatchObject({
      allowed: false,
      recorded: false,
      reason: "subscription_inactive",
    });
  });
});

describe("F.6.8 E3 foundation freeze cleanup", () => {
  it("1. REST product webhook applies stale-write protection via updated_at", async () => {
    const harness = testHarness();
    const staleAt = new Date("2026-06-20T12:00:00.000Z");
    const freshAt = new Date("2026-06-20T13:00:00.000Z");

    harness.seedProduct({
      shopifyVariantId: "gid://shopify/ProductVariant/rest-stale",
      shopifyProductUpdatedAt: freshAt,
      title: "Fresh Title",
    });

    const staleRow = normalizeWebhookVariantRow(
      {
        admin_graphql_api_id: "gid://shopify/Product/900",
        title: "Stale Title",
        status: "active",
        updated_at: staleAt.toISOString(),
        variants: [
          {
            admin_graphql_api_id: "gid://shopify/ProductVariant/rest-stale",
            inventory_quantity: 1,
          },
        ],
      },
      {
        admin_graphql_api_id: "gid://shopify/ProductVariant/rest-stale",
        inventory_quantity: 1,
      },
    );

    expect(staleRow?.shopifyProductUpdatedAt?.toISOString()).toBe(
      staleAt.toISOString(),
    );

    const upsert = await upsertVariantRow(STORE_ID, staleRow!);
    expect(upsert.action).toBe("stale_skipped");
    expect(harness.getProduct("gid://shopify/ProductVariant/rest-stale")?.title).toBe(
      "Fresh Title",
    );
  });

  it("2. incrementUsageRecord is not publicly exported", () => {
    expect(billingModule).not.toHaveProperty("incrementUsageRecord");
  });

  it("3. loader serialization hides internal operational fields", async () => {
    const serialized = serializeOnboardingForLoader({
      status: "running",
      progressPercent: 90,
      progressLabel: "Syncing orders blocked",
      productSyncStatus: "completed",
      inventorySyncStatus: "completed",
      ordersSyncStatus: "blocked",
      blockedReason: "access_denied",
      blockedMessage: "Waiting for Shopify order access approval",
      currentJobId: "job-internal-1",
      startedAt: new Date("2026-06-01T10:00:00.000Z"),
      completedAt: null,
    });

    expect(serialized).toMatchObject({
      status: "running",
      progressPercent: 90,
      ordersBlockedDisplay: {
        heading: "Orders Sync Waiting",
        primary: "Waiting for Shopify order access approval",
      },
    });
    expect(serialized).not.toHaveProperty("blockedReason");
    expect(serialized).not.toHaveProperty("blockedMessage");
    expect(serialized).not.toHaveProperty("currentJobId");
    expect(shouldShowOnboardingCardFromLoader(serialized)).toBe(true);
  });

  it("4. retryable webhook errors map to HTTP 503", () => {
    expect(isRetriableWebhookError(new Error("retriable_db_unavailable"))).toBe(
      true,
    );
    expect(isRetriableWebhookError(new Error("missing_customer"))).toBe(false);
    expect(buildWebhookCatchResponse(new Error("graphql_down")).status).toBe(503);
    expect(buildWebhookCatchResponse(new Error("missing_customer")).status).toBe(
      500,
    );
  });

  it("5. duplicate GDPR shop redact skips reprocessing", async () => {
    const harness = testHarness();
    const processedEvent = {
      id: "event-gdpr-shop-dup",
      storeId: STORE_ID,
      shopifyWebhookId: "wh-f68-gdpr-shop-dup",
      shop: SHOP,
      topic: "shop/redact",
      processedSuccessfully: true,
      processedAt: new Date(),
      createdAt: new Date(),
    };
    harness.dbState.webhookEvents.set("wh-f68-gdpr-shop-dup", processedEvent);
    harness.dbState.webhookEventsById.set(
      "event-gdpr-shop-dup",
      processedEvent,
    );

    const markSpy = vi.spyOn(webhookServer, "markWebhookEventProcessed");

    const result = await handleShopRedactWebhook({
      shop: SHOP,
      topic: "shop/redact",
      webhookId: "wh-f68-gdpr-shop-dup",
      payload: buildShopRedactPayload(),
    });

    expect(result).toEqual({
      success: true,
      action: "shop_redacted",
      skipped: true,
    });
    expect(markSpy).not.toHaveBeenCalled();
    expect(harness.dbState.stores).toHaveLength(1);
  });
});
