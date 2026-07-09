import { beforeEach, describe, expect, it, vi } from "vitest";

import prisma from "../../db.server";
import {
  ORDER_GID,
  SHOP,
  STORE_ID,
  buildOrderNode,
  mockGraphqlErrorResponse,
  mockOrderByIdResponse,
  mockOrdersSyncPageResponse,
  testHarness,
} from "./helpers/fixtures";
import { consumeAiCredits } from "../ai-cost-control.server";
import { getOrCreateStoreOnboarding } from "../onboarding.server";
import {
  handleOrderCreateWebhook,
  syncOrdersIncremental,
  upsertOrderWithLineItems,
} from "../orders.server";
import { upsertVariantRow } from "../product.server";
import {
  StoreUpsertError,
  upsertStoreFromSession,
} from "../store.server";
import {
  checkUsageLimit,
  getStoreEntitlements,
  recordUsageIfAllowed,
} from "../entitlements.server";
import {
  buildWebhookCatchResponse,
  isRetriableWebhookError,
} from "../webhook.server";

beforeEach(() => {
  const harness = testHarness();
  harness.resetDbState();
  vi.clearAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("F.6.10 C1 — afterAuth store bootstrap failure", () => {
  it("throws StoreUpsertError when shop metadata is unavailable", async () => {
    const admin = {
      graphql: vi.fn().mockResolvedValue({
        json: async () => ({ data: { shop: null } }),
      }),
    };

    await expect(
      upsertStoreFromSession(
        {
          shop: SHOP,
          accessToken: "token",
        } as Parameters<typeof upsertStoreFromSession>[0],
        admin,
      ),
    ).rejects.toThrow(StoreUpsertError);

    await expect(
      upsertStoreFromSession(
        {
          shop: SHOP,
          accessToken: "token",
        } as Parameters<typeof upsertStoreFromSession>[0],
        admin,
      ),
    ).rejects.toMatchObject({ reason: "shop_metadata_unavailable" });
  });

  it("returns storeId when upsert succeeds", async () => {
    const admin = {
      graphql: vi.fn().mockResolvedValue({
        json: async () => ({
          data: {
            shop: {
              id: "gid://shopify/Shop/1",
              name: "Test Shop",
              currencyCode: "USD",
              ianaTimezone: "America/New_York",
              myshopifyDomain: SHOP,
            },
          },
        }),
      }),
    };

    const result = await upsertStoreFromSession(
      {
        shop: SHOP,
        accessToken: "token",
      } as Parameters<typeof upsertStoreFromSession>[0],
      admin,
    );

    expect(result.storeId).toBe(STORE_ID);
    expect(testHarness().getStore().active).toBe(true);
  });
});

describe("F.6.10 C2 — order webhook stale header handling", () => {
  it("returns skipped stale_order_header instead of silent success", async () => {
    const harness = testHarness();
    const existingUpdatedAt = new Date("2026-06-20T14:00:00.000Z");
    const staleUpdatedAt = new Date("2026-06-20T12:00:00.000Z");

    harness.seedOrder({
      shopifyOrderId: ORDER_GID,
      shopifyUpdatedAt: existingUpdatedAt,
    });

    harness.mockAdminGraphql.mockResolvedValue(
      mockOrderByIdResponse(
        buildOrderNode({
          id: ORDER_GID,
          name: "#1001",
          updatedAt: staleUpdatedAt.toISOString(),
        }),
      ),
    );

    const result = await handleOrderCreateWebhook({
      shop: SHOP,
      topic: "orders/create",
      webhookId: "wh-f610-stale-header",
      payload: { admin_graphql_api_id: ORDER_GID },
    });

    expect(result).toMatchObject({
      success: true,
      skipped: true,
      skipReason: "stale_order_header",
      shopifyOrderId: ORDER_GID,
    });
    expect(result.skipped).toBe(true);
  });
});

describe("F.6.10 C3 — incremental watermark safety", () => {
  it("does not advance lastOrdersSyncAt when skipped > 0", async () => {
    const harness = testHarness();
    harness.getStore().lastOrdersSyncAt = new Date("2026-01-01T00:00:00.000Z");
    const previousWatermark = harness.getStore().lastOrdersSyncAt;

    harness.mockAdminGraphql.mockResolvedValueOnce(
      mockOrdersSyncPageResponse({
        orders: [
          buildOrderNode({
            id: "gid://shopify/Order/1002",
            name: "#1002",
            processedAt: null,
          }),
        ],
        hasNextPage: false,
      }),
    );

    const result = await syncOrdersIncremental({
      storeId: STORE_ID,
      shop: SHOP,
      admin: { graphql: harness.mockAdminGraphql },
    });

    expect(result.skipped).toBeGreaterThan(0);
    expect(result.success).toBe(false);
    expect(result.blocked).toBeFalsy();
    expect(harness.getStore().lastOrdersSyncAt?.toISOString()).toBe(
      previousWatermark?.toISOString(),
    );
  });

  it("advances lastOrdersSyncAt only on clean success", async () => {
    const harness = testHarness();
    harness.getStore().lastOrdersSyncAt = new Date("2026-01-01T00:00:00.000Z");

    harness.mockAdminGraphql.mockResolvedValueOnce(
      mockOrdersSyncPageResponse({
        orders: [buildOrderNode({ id: "gid://shopify/Order/7001", name: "#7001" })],
        hasNextPage: false,
      }),
    );

    const result = await syncOrdersIncremental({
      storeId: STORE_ID,
      shop: SHOP,
      admin: { graphql: harness.mockAdminGraphql },
    });

    expect(result.success).toBe(true);
    expect(result.skipped).toBe(0);
    expect(harness.getStore().lastOrdersSyncAt).not.toBeNull();
  });

  it("does not advance lastOrdersSyncAt when sync is blocked", async () => {
    const harness = testHarness();
    const previousWatermark = new Date("2026-01-01T00:00:00.000Z");
    harness.getStore().lastOrdersSyncAt = previousWatermark;

    harness.mockAdminGraphql.mockResolvedValueOnce(
      mockGraphqlErrorResponse("Access denied for orders field"),
    );

    const result = await syncOrdersIncremental({
      storeId: STORE_ID,
      shop: SHOP,
      admin: { graphql: harness.mockAdminGraphql },
    });

    expect(result.blocked).toBe(true);
    expect(result.success).toBe(false);
    expect(harness.getStore().lastOrdersSyncAt?.toISOString()).toBe(
      previousWatermark.toISOString(),
    );
  });
});

describe("F.6.10 C4 — permanent orders access errors", () => {
  it("finalizes webhook and blocks onboarding without retry loop", async () => {
    const harness = testHarness();
    await getOrCreateStoreOnboarding(STORE_ID);

    harness.mockAdminGraphql.mockResolvedValue(
      mockGraphqlErrorResponse("Access denied for orders field"),
    );

    const result = await handleOrderCreateWebhook({
      shop: SHOP,
      topic: "orders/create",
      webhookId: "wh-f610-access-denied",
      payload: { admin_graphql_api_id: ORDER_GID },
    });

    expect(result).toMatchObject({
      success: true,
      skipped: true,
      skipReason: "access_denied",
    });
    expect(
      harness.dbState.webhookEvents.get("wh-f610-access-denied"),
    ).toMatchObject({
      processedSuccessfully: true,
    });
    expect(harness.getOnboarding(STORE_ID)?.ordersSyncStatus).toBe("blocked");
    expect(isRetriableWebhookError(new Error("access_denied"))).toBe(false);
    expect(buildWebhookCatchResponse(new Error("access_denied")).status).toBe(
      500,
    );
  });
});

describe("F.6.10 C5 — product create race recovery", () => {
  it("applies incoming payload after P2002 create race", async () => {
    const harness = testHarness();
    const variantId = "gid://shopify/ProductVariant/race-1";
    const freshAt = new Date("2026-06-20T15:00:00.000Z");

    harness.seedProduct({
      shopifyVariantId: variantId,
      title: "Existing Title",
      shopifyProductUpdatedAt: new Date("2026-06-20T10:00:00.000Z"),
    });

    const row: Parameters<typeof upsertVariantRow>[1] = {
      shopifyProductId: "gid://shopify/Product/100",
      shopifyVariantId: variantId,
      shopifyInventoryItemId: "gid://shopify/InventoryItem/100",
      title: "Incoming Title",
      sku: "SKU-RACE",
      status: "active",
      price: null,
      inventoryQuantity: 5,
      shopifyProductUpdatedAt: freshAt,
    };

    const result = await upsertVariantRow(STORE_ID, row, "webhook");

    expect(result.action).toBe("updated");
    expect(harness.getProduct(variantId)?.title).toBe("Incoming Title");
  });
});

describe("F.6.10 H1 — subscription_missing write block", () => {
  it("blocks product, order, AI, and report writes without subscription", async () => {
    const harness = testHarness();
    harness.dbState.subscriptions.clear();

    const entitlements = await getStoreEntitlements(STORE_ID);
    expect(entitlements?.fallbackReason).toBe("subscription_missing");

    const products = await checkUsageLimit(STORE_ID, "products", 1);
    const orders = await checkUsageLimit(STORE_ID, "orders", 1);
    const ai = await checkUsageLimit(STORE_ID, "ai_requests", 1);
    const reports = await checkUsageLimit(STORE_ID, "reports_generated", 1);

    for (const check of [products, orders, ai, reports]) {
      expect(check.allowed).toBe(false);
      expect(check.reason).toBe("subscription_missing");
    }

    const aiDebit = await consumeAiCredits(STORE_ID, 1);
    expect(aiDebit.allowed).toBe(false);
    expect(aiDebit.reason).toBe("subscription_missing");

    const reportWrite = await recordUsageIfAllowed(
      STORE_ID,
      "reports_generated",
      1,
    );
    expect(reportWrite).toMatchObject({
      allowed: false,
      recorded: false,
      reason: "subscription_missing",
    });
  });
});

describe("F.6.10 C2 upsertOrderWithLineItems contract", () => {
  it("surfaces staleSkipped from upsertOrderWithLineItems", async () => {
    const harness = testHarness();
    const existingUpdatedAt = new Date("2026-06-20T14:00:00.000Z");
    const staleUpdatedAt = new Date("2026-06-20T12:00:00.000Z");

    harness.seedOrder({
      shopifyOrderId: ORDER_GID,
      shopifyUpdatedAt: existingUpdatedAt,
    });

    const order = harness.getOrder(ORDER_GID);
    if (!order) {
      throw new Error("seed order missing");
    }

    const result = await upsertOrderWithLineItems(
      STORE_ID,
      {
        shopifyOrderId: ORDER_GID,
        orderName: order.orderName,
        shopifyCreatedAt: order.shopifyCreatedAt,
        shopifyUpdatedAt: staleUpdatedAt,
        processedAt: order.processedAt,
        cancelledAt: null,
        metricDate: order.metricDate,
        displayFinancialStatus: order.displayFinancialStatus,
        currencyCode: order.currencyCode,
        subtotalAmount: "0.00",
        totalTaxAmount: "0.00",
        totalDiscountAmount: "0.00",
        totalPriceAmount: "0.00",
        totalRefundedAmount: "0.00",
        isTest: false,
        isPaid: true,
      },
      [],
      prisma,
      false,
    );

    expect(result.staleSkipped).toBe(true);
    expect(result.lineItemsUpserted).toBe(0);
  });
});
