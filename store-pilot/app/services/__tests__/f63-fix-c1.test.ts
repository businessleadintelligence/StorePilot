import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  PRODUCT_GID,
  SHOP,
  STORE_ID,
  VARIANT_GID,
  VARIANT_GID_2,
  buildOrderNode,
  mockOrdersSyncPageResponse,
  mockProductByIdResponse,
  mockProductsSyncGraphqlResponse,
  testHarness,
} from "./helpers/fixtures";
import { syncOrdersFromShopify } from "../orders.server";
import {
  fetchProductById,
  handleProductUpdateWebhook,
  syncProductsFromShopify,
} from "../product.server";
import {
  buildWebhookActionResponse,
  claimWebhookEvent,
} from "../webhook.server";

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

beforeEach(() => {
  const harness = testHarness();
  harness.resetDbState();
  vi.restoreAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("F.6.3 FIX-C1", () => {
  it("1. product update webhook uses authoritative GraphQL fetch", async () => {
    const harness = testHarness();
    harness.seedProduct({
      shopifyVariantId: VARIANT_GID,
      title: "Old Title",
    });

    harness.mockAdminGraphql.mockResolvedValue(
      mockProductByIdResponse({
        title: "GraphQL Product Title",
      }),
    );

    const result = await handleProductUpdateWebhook({
      shop: SHOP,
      topic: "products/update",
      webhookId: "wh-c1-graphql-path",
      payload: {
        admin_graphql_api_id: PRODUCT_GID,
        title: "REST Payload Title",
        status: "active",
        variants: [
          {
            admin_graphql_api_id: VARIANT_GID,
            inventory_item_id: 123,
            inventory_quantity: 99,
            sku: "SKU-1",
            price: "19.99",
          },
        ],
      },
    });

    expect(result.success).toBe(true);
    expect(harness.getProduct(VARIANT_GID)?.title).toBe("GraphQL Product Title");
    expect(harness.mockAdminGraphql).toHaveBeenCalled();
  });

  it("2. GraphQL failure during product update returns retryable 503", async () => {
    const harness = testHarness();
    harness.mockAdminGraphql.mockRejectedValue(new Error("graphql_down"));

    const result = await handleProductUpdateWebhook({
      shop: SHOP,
      topic: "products/update",
      webhookId: "wh-c1-graphql-fail",
      payload: {
        admin_graphql_api_id: PRODUCT_GID,
        title: "Test Product",
        status: "active",
        variants: [],
      },
    });

    expect(result).toMatchObject({
      success: false,
      retryable: true,
      reason: "graphql_fetch_failed",
    });
    expect(buildWebhookActionResponse(result).status).toBe(503);
    expect(
      harness.dbState.webhookEvents.get("wh-c1-graphql-fail")?.processedSuccessfully,
    ).toBe(false);
  });

  it("3. bootstrap sync reconciles removed variants when variant set is complete", async () => {
    const harness = testHarness();
    harness.seedProduct({
      shopifyVariantId: VARIANT_GID,
      status: "active",
    });
    harness.seedProduct({
      shopifyVariantId: VARIANT_GID_2,
      status: "active",
    });

    harness.mockAdminGraphql.mockResolvedValue(
      mockProductsSyncGraphqlResponse({
        inventoryQuantity: 8,
        tracked: true,
      }),
    );

    const result = await syncProductsFromShopify({
      storeId: STORE_ID,
      shop: SHOP,
      admin: { graphql: harness.mockAdminGraphql },
    });

    expect(result.success).toBe(true);
    expect(harness.getProduct(VARIANT_GID)?.status).toBe("active");
    expect(harness.getProduct(VARIANT_GID_2)?.status).toBe("archived");
  });

  it("4. bootstrap sync skips reconcile when normalized variant set is incomplete", async () => {
    const harness = testHarness();
    harness.seedProduct({
      shopifyVariantId: VARIANT_GID_2,
      status: "active",
    });

    harness.mockAdminGraphql.mockResolvedValue(
      Response.json({
        data: {
          products: {
            edges: [
              {
                node: {
                  id: PRODUCT_GID,
                  title: "Test Product",
                  status: "ACTIVE",
                  variants: {
                    edges: [
                      { node: trackedVariantNode },
                      {
                        node: {
                          id: null,
                          sku: "BAD",
                          price: "1.00",
                          inventoryQuantity: 1,
                          inventoryItem: {
                            id: "gid://shopify/InventoryItem/999",
                            tracked: true,
                          },
                        },
                      },
                    ],
                    pageInfo: { hasNextPage: false, endCursor: null },
                  },
                },
              },
            ],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      }),
    );

    const result = await syncProductsFromShopify({
      storeId: STORE_ID,
      shop: SHOP,
      admin: { graphql: harness.mockAdminGraphql },
    });

    expect(result.success).toBe(false);
    expect(harness.getProduct(VARIANT_GID_2)?.status).toBe("active");
    expect(console.warn).toHaveBeenCalledWith(
      "[product-sync]",
      expect.objectContaining({
        operation: "sync_reconcile_skipped",
      }),
    );
  });

  it("5. historicalOrdersImportDone stays false when skipped orders remain", async () => {
    const harness = testHarness();
    harness.mockAdminGraphql.mockResolvedValue(
      mockOrdersSyncPageResponse({
        orders: [
          buildOrderNode(),
          buildOrderNode({
            id: "gid://shopify/Order/1002",
            name: "#1002",
            processedAt: null,
          }),
        ],
      }),
    );

    const result = await syncOrdersFromShopify({
      storeId: STORE_ID,
      shop: SHOP,
      admin: { graphql: harness.mockAdminGraphql },
    });

    expect(result.success).toBe(false);
    expect(result.skipped).toBeGreaterThan(0);
    expect(harness.getStore().historicalOrdersImportDone).toBe(false);
    expect(harness.getStore().lastOrdersSyncAt).toBeNull();
  });

  it("6. webhook P2002 race reclaims unprocessed event instead of duplicate ack", async () => {
    const harness = testHarness();
    const eventId = crypto.randomUUID();
    const existingEvent = {
      id: eventId,
      storeId: STORE_ID,
      shopifyWebhookId: "wh-c1-p2002",
      shop: SHOP,
      topic: "products/update",
      processedSuccessfully: false,
      processedAt: new Date(),
      createdAt: new Date(),
    };
    harness.dbState.webhookEvents.set("wh-c1-p2002", existingEvent);
    harness.dbState.webhookEventsById.set(eventId, existingEvent);

    let findCalls = 0;
    const findSpy = vi
      .spyOn(harness.prismaMock.webhookEvent, "findUnique")
      .mockImplementation(async () => {
        findCalls += 1;
        if (findCalls === 1) {
          return null;
        }

        return harness.dbState.webhookEvents.get("wh-c1-p2002") ?? null;
      });

    const createSpy = vi
      .spyOn(harness.prismaMock.webhookEvent, "create")
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "test",
        }),
      );

    const result = await claimWebhookEvent({
      storeId: STORE_ID,
      shop: SHOP,
      topic: "products/update",
      webhookId: "wh-c1-p2002",
    });

    expect(result).toMatchObject({
      status: "claimed",
      eventId,
    });

    findSpy.mockRestore();
    createSpy.mockRestore();
  });

  it("7. processed webhook delivery is still treated as duplicate", async () => {
    const harness = testHarness();
    const eventId = crypto.randomUUID();
    harness.dbState.webhookEvents.set("wh-c1-processed", {
      id: eventId,
      storeId: STORE_ID,
      shopifyWebhookId: "wh-c1-processed",
      shop: SHOP,
      topic: "products/update",
      processedSuccessfully: true,
      processedAt: new Date(),
      createdAt: new Date(),
    });
    harness.dbState.webhookEventsById.set(
      eventId,
      harness.dbState.webhookEvents.get("wh-c1-processed")!,
    );

    const result = await claimWebhookEvent({
      storeId: STORE_ID,
      shop: SHOP,
      topic: "products/update",
      webhookId: "wh-c1-processed",
    });

    expect(result).toEqual({ status: "duplicate" });
  });

  it("8. zero-variant authoritative product archives existing rows", async () => {
    const harness = testHarness();
    harness.seedProduct({
      shopifyVariantId: VARIANT_GID,
      status: "active",
    });
    harness.seedProduct({
      shopifyVariantId: VARIANT_GID_2,
      status: "active",
    });

    harness.mockAdminGraphql.mockResolvedValue(
      mockProductByIdResponse({
        variants: [],
      }),
    );

    const result = await handleProductUpdateWebhook({
      shop: SHOP,
      topic: "products/update",
      webhookId: "wh-c1-zero-variants",
      payload: {
        admin_graphql_api_id: PRODUCT_GID,
        title: "Empty Product",
        status: "active",
        variants: [
          {
            admin_graphql_api_id: VARIANT_GID,
            inventory_item_id: 123,
            inventory_quantity: 1,
            sku: "SKU-1",
            price: "19.99",
          },
        ],
      },
    });

    expect(result.success).toBe(true);
    expect(result.archived).toBe(2);
    expect(harness.getProduct(VARIANT_GID)?.status).toBe("archived");
    expect(harness.getProduct(VARIANT_GID_2)?.status).toBe("archived");
    expect(console.info).toHaveBeenCalledWith(
      "[product-webhook]",
      expect.objectContaining({
        operation: "product_variants_archived",
      }),
    );
  });

  it("fetchProductById loads authoritative product data", async () => {
    const harness = testHarness();
    harness.mockAdminGraphql.mockResolvedValue(
      mockProductByIdResponse({
        title: "GraphQL Product Title",
      }),
    );

    const fetched = await fetchProductById(
      { graphql: harness.mockAdminGraphql },
      SHOP,
      STORE_ID,
      PRODUCT_GID,
    );

    expect(fetched?.product.title).toBe("GraphQL Product Title");
    expect(fetched?.variants).toHaveLength(1);
  });
});
