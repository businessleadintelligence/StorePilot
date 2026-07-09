import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ORDER_GID,
  PRODUCT_GID,
  SHOP,
  STORE_ID,
  VARIANT_GID,
  VARIANT_GID_2,
  testHarness,
} from "./helpers/fixtures";
import { handleOrderCreateWebhook } from "../orders.server";
import { handleProductCreateWebhook } from "../product.server";
import * as webhookServer from "../webhook.server";

const multiVariantPayload = {
  admin_graphql_api_id: PRODUCT_GID,
  title: "Multi Variant Product",
  status: "active",
  variants: [
    {
      admin_graphql_api_id: VARIANT_GID,
      inventory_item_id: 123,
      inventory_quantity: 3,
      inventory_management: null,
      sku: "SKU-1",
      price: "19.99",
    },
    {
      admin_graphql_api_id: VARIANT_GID_2,
      inventory_item_id: 124,
      inventory_quantity: 7,
      inventory_management: null,
      sku: "SKU-2",
      price: "29.99",
    },
  ],
};

beforeEach(() => {
  const harness = testHarness();
  harness.resetDbState();
  harness.mockAdminGraphql.mockReset();
  vi.clearAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("F.2.2 Webhook Retry Taxonomy", () => {
  it("1. GraphQL failure during order webhook throws and does not mark processed", async () => {
    const harness = testHarness();
    harness.mockAdminGraphql.mockRejectedValue(new Error("graphql_down"));
    const markSpy = vi.spyOn(webhookServer, "markWebhookEventProcessed");

    await expect(
      handleOrderCreateWebhook({
        shop: SHOP,
        topic: "orders/create",
        webhookId: "wh-f22-order-graphql-fail",
        payload: {
          admin_graphql_api_id: ORDER_GID,
        },
      }),
    ).rejects.toThrow("graphql_down");

    expect(markSpy).not.toHaveBeenCalled();
    const claimedEvent = harness.dbState.webhookEvents.get(
      "wh-f22-order-graphql-fail",
    );
    expect(claimedEvent?.processedSuccessfully).toBe(false);
  });

  it("2. processing failure during product webhook throws and does not mark processed", async () => {
    const harness = testHarness();
    const defaultCreate = harness.prismaMock.product.create.getMockImplementation();
    let createAttempts = 0;

    harness.prismaMock.product.create.mockImplementation(async (args) => {
      createAttempts += 1;
      if (createAttempts === 2) {
        throw new Error("simulated_variant_write_failure");
      }

      return defaultCreate!(args);
    });

    const markSpy = vi.spyOn(webhookServer, "markWebhookEventProcessed");

    await expect(
      handleProductCreateWebhook({
        shop: SHOP,
        topic: "products/create",
        webhookId: "wh-f22-product-fail",
        payload: multiVariantPayload,
      }),
    ).rejects.toThrow("simulated_variant_write_failure");

    expect(markSpy).not.toHaveBeenCalled();
    const claimedEvent = harness.dbState.webhookEvents.get("wh-f22-product-fail");
    expect(claimedEvent?.processedSuccessfully).toBe(false);
  });

  it("3. permanent invalid payload is skipped and marked processed", async () => {
    const harness = testHarness();
    const markSpy = vi.spyOn(webhookServer, "markWebhookEventProcessed");

    const result = await handleProductCreateWebhook({
      shop: SHOP,
      topic: "products/create",
      webhookId: "wh-f22-invalid-payload",
      payload: { not_a_product: true },
    });

    expect(result.success).toBe(true);
    expect(result.skipped).toBe(1);
    expect(markSpy).toHaveBeenCalledTimes(1);

    const claimedEvent = harness.dbState.webhookEvents.get(
      "wh-f22-invalid-payload",
    );
    expect(claimedEvent?.processedSuccessfully).toBe(true);
  });

  it("4. duplicate webhook is ignored without writes or re-marking", async () => {
    const harness = testHarness();
    const processedEvent = {
      id: "event-f22-dup",
      storeId: STORE_ID,
      shopifyWebhookId: "wh-f22-dup",
      shop: SHOP,
      topic: "products/create",
      processedSuccessfully: true,
      processedAt: new Date(),
      createdAt: new Date(),
    };
    harness.dbState.webhookEvents.set("wh-f22-dup", processedEvent);
    harness.dbState.webhookEventsById.set("event-f22-dup", processedEvent);

    const markSpy = vi.spyOn(webhookServer, "markWebhookEventProcessed");

    const result = await handleProductCreateWebhook({
      shop: SHOP,
      topic: "products/create",
      webhookId: "wh-f22-dup",
      payload: multiVariantPayload,
    });

    expect(result.success).toBe(true);
    expect(result.skipped).toBe(1);
    expect(result.upserted).toBe(0);
    expect(markSpy).not.toHaveBeenCalled();
    expect(harness.dbState.products.size).toBe(0);
  });
});
