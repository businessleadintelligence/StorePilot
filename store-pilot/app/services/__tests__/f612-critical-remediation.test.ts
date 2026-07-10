import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ORDER_GID,
  PRODUCT_GID,
  SHOP,
  STORE_ID,
  VARIANT_GID,
  VARIANT_GID_2,
  buildOrderNode,
  testHarness,
} from "./helpers/fixtures";
import { createTrialSubscription } from "../billing.server";
import { getResolvedPlanLimit } from "../../billing/plan-registry";
import {
  REDACTED_ORDER_NAME,
  handleCustomersDataRequestWebhook,
  handleCustomersRedactWebhook,
} from "../gdpr.server";
import {
  normalizeOrderRow,
  upsertOrderRow,
} from "../orders.server";
import {
  normalizeVariantRow,
  upsertVariantRow,
} from "../product.server";
import * as webhookServer from "../webhook.server";

const CUSTOMER_ID = "191167";
const REQUESTED_ORDER_GID = "gid://shopify/Order/299938";

const productNode = {
  id: PRODUCT_GID,
  title: "Test Product",
  status: "ACTIVE",
  updatedAt: "2026-06-20T12:00:00Z",
  variants: { pageInfo: { hasNextPage: false } },
};

const trackedVariantNode = {
  id: VARIANT_GID,
  sku: "SKU-1",
  price: "19.99",
  inventoryQuantity: 3,
  inventoryItem: {
    id: "gid://shopify/InventoryItem/123",
    tracked: true,
  },
};

const secondVariantNode = {
  id: VARIANT_GID_2,
  sku: "SKU-2",
  price: "29.99",
  inventoryQuantity: 5,
  inventoryItem: {
    id: "gid://shopify/InventoryItem/124",
    tracked: true,
  },
};

function buildCustomerPayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    shop_id: 954889,
    shop_domain: SHOP,
    customer: {
      id: Number(CUSTOMER_ID),
      email: "john@example.com",
      phone: "555-625-1199",
    },
    orders_requested: [299938],
    data_request: { id: 9999 },
    ...overrides,
  };
}

function buildCustomerRedactPayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    shop_id: 954889,
    shop_domain: SHOP,
    customer: {
      id: Number(CUSTOMER_ID),
      email: "john@example.com",
      phone: "555-625-1199",
    },
    orders_to_redact: [299938],
    ...overrides,
  };
}

function expectNoPiiLogged(): void {
  const infoCalls = vi.mocked(console.info).mock.calls;
  const errorCalls = vi.mocked(console.error).mock.calls;
  const allCalls = [...infoCalls, ...errorCalls];

  for (const call of allCalls) {
    const serialized = JSON.stringify(call);
    expect(serialized).not.toContain("john@example.com");
    expect(serialized).not.toContain("555-625-1199");
  }
}

function seedProducts(count: number) {
  const harness = testHarness();

  for (let index = 0; index < count; index += 1) {
    harness.seedProduct({
      shopifyVariantId: `gid://shopify/ProductVariant/bill-prod-${index}`,
    });
  }
}

function seedOrders(count: number) {
  const harness = testHarness();

  for (let index = 0; index < count; index += 1) {
    harness.seedOrder({
      shopifyOrderId: `gid://shopify/Order/bill-order-${index}`,
    });
  }
}

beforeEach(() => {
  const harness = testHarness();
  harness.resetDbState();
  vi.clearAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("F.6.12 A — customer GDPR compliance", () => {
  it("exports customer-linked order data on data_request", async () => {
    const harness = testHarness();
    harness.seedOrder({
      shopifyOrderId: REQUESTED_ORDER_GID,
      orderName: "#299938",
    });
    harness.seedOrderLineItem({
      shopifyLineItemId: "gid://shopify/LineItem/1",
      shopifyOrderId: REQUESTED_ORDER_GID,
      orderId: harness.getOrder(REQUESTED_ORDER_GID)!.id,
    });

    const result = await handleCustomersDataRequestWebhook({
      shop: SHOP,
      topic: "customers/data_request",
      webhookId: "wh-f612-data-1",
      payload: buildCustomerPayload(),
    });

    expect(result).toMatchObject({
      success: true,
      action: "customer_data_exported",
      shopifyCustomerId: CUSTOMER_ID,
      storeId: STORE_ID,
    });
    expect(result.export?.orders).toHaveLength(1);
    expect(result.export?.orders[0]?.shopifyOrderId).toBe(REQUESTED_ORDER_GID);
    expect(result.export?.storedCustomerProfile.email).toBe(false);
    expect(result.export?.storedCustomerProfile.note).toContain(
      "does not persist Shopify customer profile fields",
    );
    expect(console.info).toHaveBeenCalledWith(
      "[gdpr-webhook]",
      expect.objectContaining({ operation: "customer_data_request_processed" }),
    );
    expectNoPiiLogged();
  });

  it("is idempotent on repeated data_request deliveries", async () => {
    const result = await handleCustomersDataRequestWebhook({
      shop: SHOP,
      topic: "customers/data_request",
      webhookId: "wh-f612-data-dup",
      payload: buildCustomerPayload(),
    });

    expect(result.action).toBe("customer_data_exported");

    const duplicate = await handleCustomersDataRequestWebhook({
      shop: SHOP,
      topic: "customers/data_request",
      webhookId: "wh-f612-data-dup",
      payload: buildCustomerPayload(),
    });

    expect(duplicate).toMatchObject({
      success: true,
      action: "customer_data_exported",
      skipped: true,
    });
  });

  it("redacts customer-linked orders on customers/redact", async () => {
    const harness = testHarness();
    harness.seedOrder({
      shopifyOrderId: REQUESTED_ORDER_GID,
      orderName: "#299938",
    });

    const result = await handleCustomersRedactWebhook({
      shop: SHOP,
      topic: "customers/redact",
      webhookId: "wh-f612-redact-1",
      payload: buildCustomerRedactPayload(),
    });

    expect(result).toMatchObject({
      success: true,
      action: "customer_redacted",
      shopifyCustomerId: CUSTOMER_ID,
      storeId: STORE_ID,
    });
    expect(result.redact?.ordersRedacted).toBe(1);
    expect(harness.getOrder(REQUESTED_ORDER_GID)?.orderName).toBe(
      REDACTED_ORDER_NAME,
    );
    expect(console.info).toHaveBeenCalledWith(
      "[gdpr-webhook]",
      expect.objectContaining({ operation: "customer_redacted" }),
    );
    expectNoPiiLogged();
  });

  it("does not double-redact on repeated redact deliveries", async () => {
    const harness = testHarness();
    harness.seedOrder({
      shopifyOrderId: REQUESTED_ORDER_GID,
      orderName: "#299938",
    });

    await handleCustomersRedactWebhook({
      shop: SHOP,
      topic: "customers/redact",
      webhookId: "wh-f612-redact-first",
      payload: buildCustomerRedactPayload(),
    });

    const second = await handleCustomersRedactWebhook({
      shop: SHOP,
      topic: "customers/redact",
      webhookId: "wh-f612-redact-second",
      payload: buildCustomerRedactPayload(),
    });

    expect(second.redact?.alreadyRedacted).toBe(true);
    expect(second.redact?.ordersRedacted).toBe(0);
    expect(harness.getOrder(REQUESTED_ORDER_GID)?.orderName).toBe(
      REDACTED_ORDER_NAME,
    );
  });

  it("rejects missing customer payloads", async () => {
    await expect(
      handleCustomersDataRequestWebhook({
        shop: SHOP,
        topic: "customers/data_request",
        webhookId: "wh-f612-missing-customer",
        payload: { shop_domain: SHOP },
      }),
    ).rejects.toThrow("missing_customer");
  });

  it("handles missing store without leaking PII", async () => {
    const result = await handleCustomersDataRequestWebhook({
      shop: "missing-shop.myshopify.com",
      topic: "customers/data_request",
      webhookId: "wh-f612-no-store",
      payload: buildCustomerPayload({
        shop_domain: "missing-shop.myshopify.com",
      }),
    });

    expect(result).toMatchObject({
      success: true,
      action: "customer_data_exported",
      shopifyCustomerId: CUSTOMER_ID,
    });
    expect(result.export?.storeId).toBeNull();
    expect(result.export?.orders).toEqual([]);
    expectNoPiiLogged();
  });

  it("skips duplicate GDPR webhook deliveries via claim", async () => {
    const harness = testHarness();
    const processedEvent = {
      id: "event-f612-dup",
      storeId: STORE_ID,
      shopifyWebhookId: "wh-f612-gdpr-dup",
      shop: SHOP,
      topic: "customers/data_request",
      processedSuccessfully: true,
      processedAt: new Date(),
      createdAt: new Date(),
    };
    harness.dbState.webhookEvents.set("wh-f612-gdpr-dup", processedEvent);
    harness.dbState.webhookEventsById.set("event-f612-dup", processedEvent);

    const markSpy = vi.spyOn(webhookServer, "markWebhookEventProcessed");

    const result = await handleCustomersDataRequestWebhook({
      shop: SHOP,
      topic: "customers/data_request",
      webhookId: "wh-f612-gdpr-dup",
      payload: buildCustomerPayload(),
    });

    expect(result).toMatchObject({
      success: true,
      action: "customer_data_exported",
      skipped: true,
    });
    expect(markSpy).not.toHaveBeenCalled();
  });
});

describe("F.6.12 B — atomic billing enforcement", () => {
  const STARTER_PRODUCT_LIMIT = getResolvedPlanLimit("starter", "products");

  it("allows only one concurrent product create at plan limit", async () => {
    await createTrialSubscription(STORE_ID, "starter");
    seedProducts(STARTER_PRODUCT_LIMIT - 1);

    const harness = testHarness();
    const firstRow = normalizeVariantRow(productNode, trackedVariantNode);
    const secondRow = normalizeVariantRow(productNode, secondVariantNode);
    expect(firstRow).not.toBeNull();
    expect(secondRow).not.toBeNull();

    const [firstResult, secondResult] = await Promise.all([
      upsertVariantRow(STORE_ID, firstRow!, "webhook"),
      upsertVariantRow(STORE_ID, secondRow!, "webhook"),
    ]);

    const outcomes = [firstResult.action, secondResult.action].sort();
    expect(outcomes).toEqual(["created", "limit_exceeded"]);
    expect(harness.dbState.products.size).toBe(STARTER_PRODUCT_LIMIT);
  });

  it("allows only one concurrent order create at plan limit", async () => {
    await createTrialSubscription(STORE_ID, "starter");
    seedOrders(4999);

    const harness = testHarness();
    const firstOrder = normalizeOrderRow(
      buildOrderNode({
        id: ORDER_GID,
        name: "#5000",
      }) as never,
      { shop: SHOP, storeId: STORE_ID },
    );
    const secondOrder = normalizeOrderRow(
      buildOrderNode({
        id: "gid://shopify/Order/5001",
        name: "#5001",
      }) as never,
      { shop: SHOP, storeId: STORE_ID },
    );
    expect(firstOrder).not.toBeNull();
    expect(secondOrder).not.toBeNull();

    const [firstResult, secondResult] = await Promise.all([
      upsertOrderRow(STORE_ID, firstOrder!),
      upsertOrderRow(STORE_ID, secondOrder!),
    ]);

    const createdCount = [firstResult, secondResult].filter(
      (result) => result.created,
    ).length;
    const blockedCount = [firstResult, secondResult].filter(
      (result) => result.limitExceeded,
    ).length;

    expect(createdCount).toBe(1);
    expect(blockedCount).toBe(1);
    expect(harness.dbState.orders.size).toBe(5000);
  });
});
