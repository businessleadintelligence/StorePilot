import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ORDER_GID,
  ORDER_GID_PAGINATED,
  SHOP,
  STORE_ID,
  buildLineItemEdges,
  buildLineItemNode,
  buildOrderNode,
  lineItemGid,
  mockGraphqlErrorResponse,
  mockOrderByIdResponse,
  mockOrderLineItemsPageResponse,
  mockOrdersSyncPageResponse,
  testHarness,
} from "./helpers/fixtures";
import type { OrderNode } from "../orders.server";
import prisma from "../../db.server";
import {
  fetchOrderById,
  handleOrderCancelledWebhook,
  handleOrderCreateWebhook,
  handleOrderUpdatedWebhook,
  normalizeOrderLineItemRow,
  normalizeOrderRow,
  reconcileRemovedOrderLineItems,
  syncOrdersFromShopify,
  syncOrdersIncremental,
  upsertOrderLineItemRow,
  upsertOrderRow,
  upsertOrderWithLineItems,
} from "../orders.server";
import * as webhookServer from "../webhook.server";

function asOrderNode(value: Record<string, unknown>): OrderNode {
  return value as OrderNode;
}

function normalizedOrderFromNode(
  order: OrderNode,
  lineItemCount = 1,
): NonNullable<ReturnType<typeof normalizeOrderRow>> {
  const normalized = normalizeOrderRow(order, { shop: SHOP, storeId: STORE_ID });
  if (!normalized) {
    throw new Error("expected valid normalized order");
  }

  void lineItemCount;
  return normalized;
}

function normalizedLineItemsFromOrder(order: OrderNode) {
  return (order.lineItems?.edges ?? [])
    .map((edge) => normalizeOrderLineItemRow(order, edge?.node!))
    .filter((row): row is NonNullable<typeof row> => row != null);
}

function buildTenLineOrderNode(): OrderNode {
  return asOrderNode(
    buildOrderNode({
      lineItems: {
        edges: buildLineItemEdges(10),
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    }),
  );
}

beforeEach(() => {
  const harness = testHarness();
  harness.resetDbState();
  harness.mockAdminGraphql.mockReset();
  vi.clearAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("F.0.2 Orders Reliability Regression", () => {
  describe("1. Normalization", () => {
    it("normalizes a valid order", () => {
      const row = normalizeOrderRow(asOrderNode(buildOrderNode()), {
        shop: SHOP,
        storeId: STORE_ID,
      });

      expect(row).not.toBeNull();
      expect(row?.shopifyOrderId).toBe(ORDER_GID);
      expect(row?.displayFinancialStatus).toBe("paid");
      expect(row?.isPaid).toBe(true);
    });

    it("fails when order id is missing", () => {
      expect(
        normalizeOrderRow(asOrderNode(buildOrderNode({ id: null }))),
      ).toBeNull();
    });

    it("fails when processedAt is missing", () => {
      expect(
        normalizeOrderRow(asOrderNode(buildOrderNode({ processedAt: null }))),
      ).toBeNull();
    });

    it("fails when money values are invalid", () => {
      expect(
        normalizeOrderRow(
          asOrderNode(
            buildOrderNode({
              currentTotalPriceSet: { shopMoney: { amount: "not-a-number" } },
            }),
          ),
        ),
      ).toBeNull();
    });

    it("stores displayFinancialStatus lowercase and derives isPaid", () => {
      const paid = normalizeOrderRow(
        asOrderNode(buildOrderNode({ displayFinancialStatus: "PAID" })),
      );
      const pending = normalizeOrderRow(
        asOrderNode(
          buildOrderNode({
            displayFinancialStatus: "PENDING",
            id: "gid://shopify/Order/1002",
            name: "#1002",
          }),
        ),
      );

      expect(paid?.displayFinancialStatus).toBe("paid");
      expect(paid?.isPaid).toBe(true);
      expect(pending?.displayFinancialStatus).toBe("pending");
      expect(pending?.isPaid).toBe(false);
    });

    it("uses UTC boundary for metricDate", () => {
      const row = normalizeOrderRow(
        asOrderNode(
          buildOrderNode({
            processedAt: "2026-01-15T23:30:00Z",
          }),
        ),
      );

      expect(row?.metricDate.toISOString()).toBe("2026-01-15T00:00:00.000Z");
    });

    it("normalizes a valid line item row", () => {
      const order = asOrderNode(buildOrderNode());
      const lineItem = order.lineItems?.edges?.[0]?.node!;
      const row = normalizeOrderLineItemRow(order, lineItem);

      expect(row).not.toBeNull();
      expect(row?.shopifyLineItemId).toBe(lineItemGid(1));
      expect(row?.quantity).toBe(1);
    });
  });

  describe("2. Order upserts", () => {
    it("creates and updates orders without duplicates", async () => {
      const orderNode = asOrderNode(buildOrderNode());
      const normalized = normalizedOrderFromNode(orderNode);

      const created = await upsertOrderRow(STORE_ID, normalized);
      expect(created.created).toBe(true);

      const updated = await upsertOrderRow(STORE_ID, {
        ...normalized,
        orderName: "#1001-updated",
        shopifyUpdatedAt: new Date("2026-01-16T10:00:00Z"),
      });
      expect(updated.created).toBe(false);

      const { dbState } = testHarness();
      expect(dbState.orders.size).toBe(1);
      expect(testHarness().getOrder(ORDER_GID)?.orderName).toBe("#1001-updated");
    });

    it("creates and updates line items without duplicates", async () => {
      const orderNode = asOrderNode(buildOrderNode());
      const normalizedOrder = normalizedOrderFromNode(orderNode);
      const { orderId } = await upsertOrderRow(STORE_ID, normalizedOrder);
      expect(orderId).not.toBeNull();
      const lineItem = normalizedLineItemsFromOrder(orderNode)[0]!;

      const created = await upsertOrderLineItemRow(
        STORE_ID,
        orderId!,
        lineItem,
      );
      expect(created.created).toBe(true);

      const updated = await upsertOrderLineItemRow(STORE_ID, orderId!, {
        ...lineItem,
        title: "Updated Item",
      });
      expect(updated.created).toBe(false);

      const { dbState } = testHarness();
      expect(dbState.orderLineItems.size).toBe(1);
      expect(
        testHarness()
          .getOrderLineItems(orderId!)
          .every((row) => row.title === "Updated Item"),
      ).toBe(true);
    });
  });

  describe("3. Reconcile", () => {
    it("deletes removed line items and preserves active ones", async () => {
      const { seedOrder, seedOrderLineItem } = testHarness();
      const order = seedOrder({ shopifyOrderId: ORDER_GID });
      seedOrderLineItem({
        orderId: order.id,
        shopifyLineItemId: lineItemGid(1),
      });
      seedOrderLineItem({
        orderId: order.id,
        shopifyLineItemId: lineItemGid(2),
      });
      seedOrderLineItem({
        orderId: order.id,
        shopifyLineItemId: lineItemGid(3),
      });

      const result = await reconcileRemovedOrderLineItems(
        STORE_ID,
        order.id,
        [lineItemGid(1), lineItemGid(2)],
      );

      expect(result.archivedCount).toBe(1);
      expect(testHarness().getOrderLineItems(order.id)).toHaveLength(2);
      expect(
        testHarness()
          .getOrderLineItems(order.id)
          .map((row) => row.shopifyLineItemId),
      ).toEqual([lineItemGid(1), lineItemGid(2)]);
    });
  });

  describe("4. Reconcile guards (E.2.5B)", () => {
    it("Case A: reconciles when Shopify and normalized counts match", async () => {
      const { prismaMock } = testHarness();
      const deleteManySpy = vi.spyOn(prismaMock.orderLineItem, "deleteMany");
      const orderNode = buildTenLineOrderNode();
      const normalizedOrder = normalizedOrderFromNode(orderNode);
      const normalizedLineItems = normalizedLineItemsFromOrder(orderNode);

      const result = await upsertOrderWithLineItems(
        STORE_ID,
        normalizedOrder,
        normalizedLineItems,
        prisma,
        true,
        10,
      );

      expect(deleteManySpy).toHaveBeenCalledTimes(1);
      expect(result.archivedLineItems).toBe(0);
    });

    it("Case B: skips reconcile when normalized set is incomplete", async () => {
      const { prismaMock } = testHarness();
      const deleteManySpy = vi.spyOn(prismaMock.orderLineItem, "deleteMany");
      const orderNode = buildTenLineOrderNode();
      const normalizedOrder = normalizedOrderFromNode(orderNode);
      const normalizedLineItems = normalizedLineItemsFromOrder(orderNode).slice(
        0,
        9,
      );

      const result = await upsertOrderWithLineItems(
        STORE_ID,
        normalizedOrder,
        normalizedLineItems,
        prisma,
        false,
        10,
      );

      expect(deleteManySpy).not.toHaveBeenCalled();
      expect(result.archivedLineItems).toBe(0);
    });

    it("Case C: skips reconcile for empty normalized line item set", async () => {
      const { prismaMock } = testHarness();
      const deleteManySpy = vi.spyOn(prismaMock.orderLineItem, "deleteMany");
      const orderNode = asOrderNode(buildOrderNode());
      const normalizedOrder = normalizedOrderFromNode(orderNode);

      const result = await upsertOrderWithLineItems(
        STORE_ID,
        normalizedOrder,
        [],
        prisma,
        true,
        0,
      );

      expect(deleteManySpy).not.toHaveBeenCalled();
      expect(result.archivedLineItems).toBe(0);
      expect(console.warn).toHaveBeenCalledWith(
        "[order-sync]",
        expect.objectContaining({
          operation: "order_reconcile_skipped",
          reason: "empty_line_item_set",
        }),
      );
    });
  });

  describe("5. Historical import", () => {
    it("imports valid orders, skips invalid orders, and updates store flags", async () => {
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
      expect(result.upserted).toBe(1);
      expect(result.skipped).toBeGreaterThanOrEqual(1);
      expect(harness.getStore().historicalOrdersImportDone).toBe(false);
      expect(harness.getStore().lastOrdersSyncAt).toBeNull();
      expect(harness.getOrder(ORDER_GID)).toBeDefined();
      expect(harness.getOrder("gid://shopify/Order/1002")).toBeUndefined();
    });

    it("skips orders when line-item pagination fails and continues import", async () => {
      const harness = testHarness();
      harness.mockAdminGraphql
        .mockResolvedValueOnce(
          mockOrdersSyncPageResponse({
            orders: [
              buildOrderNode({
                id: ORDER_GID_PAGINATED,
                name: "#2001",
                lineItems: {
                  edges: buildLineItemEdges(1),
                  pageInfo: {
                    hasNextPage: true,
                    endCursor: "li-page-2",
                  },
                },
              }),
              buildOrderNode({
                id: "gid://shopify/Order/3001",
                name: "#3001",
              }),
            ],
          }),
        )
        .mockResolvedValueOnce(mockGraphqlErrorResponse("pagination failed"));

      const transactionSpy = vi.spyOn(harness.prismaMock, "$transaction");
      const result = await syncOrdersFromShopify({
        storeId: STORE_ID,
        shop: SHOP,
        admin: { graphql: harness.mockAdminGraphql },
      });

      expect(result.success).toBe(false);
      expect(result.upserted).toBe(1);
      expect(result.skipped).toBeGreaterThanOrEqual(1);
      expect(harness.getOrder(ORDER_GID_PAGINATED)).toBeUndefined();
      expect(harness.getOrder("gid://shopify/Order/3001")).toBeDefined();
      expect(transactionSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("6. Incremental sync", () => {
    it("saves cursor after page processing and clears it on completion", async () => {
      const harness = testHarness();
      harness.getStore().lastOrdersSyncAt = new Date("2026-01-01T00:00:00Z");
      harness.getStore().ordersSyncCursor = null;

      harness.mockAdminGraphql
        .mockResolvedValueOnce(
          mockOrdersSyncPageResponse({
            orders: [buildOrderNode({ id: "gid://shopify/Order/4001", name: "#4001" })],
            hasNextPage: true,
            endCursor: "orders-page-2",
          }),
        )
        .mockResolvedValueOnce(
          mockOrdersSyncPageResponse({
            orders: [buildOrderNode({ id: "gid://shopify/Order/4002", name: "#4002" })],
            hasNextPage: false,
            endCursor: null,
          }),
        );

      const storeUpdateSpy = vi.spyOn(harness.prismaMock.store, "update");
      const result = await syncOrdersIncremental({
        storeId: STORE_ID,
        shop: SHOP,
        admin: { graphql: harness.mockAdminGraphql },
      });

      expect(result.success).toBe(true);
      expect(harness.getStore().ordersSyncCursor).toBeNull();
      expect(harness.getStore().lastOrdersSyncAt).not.toBeNull();

      const cursorSaveIndex = storeUpdateSpy.mock.calls.findIndex(
        ([call]) =>
          (call.data as { ordersSyncCursor?: string | null }).ordersSyncCursor ===
          "orders-page-2",
      );
      expect(cursorSaveIndex).toBeGreaterThanOrEqual(0);

      const cursorSaveInvocationOrder =
        storeUpdateSpy.mock.invocationCallOrder[cursorSaveIndex];
      const firstGraphqlInvocationOrder =
        harness.mockAdminGraphql.mock.invocationCallOrder[0]!;
      expect(cursorSaveInvocationOrder).toBeGreaterThan(
        firstGraphqlInvocationOrder,
      );
    });

    it("retains cursor when a later page fails", async () => {
      const harness = testHarness();
      harness.getStore().lastOrdersSyncAt = new Date("2026-01-01T00:00:00Z");

      harness.mockAdminGraphql
        .mockResolvedValueOnce(
          mockOrdersSyncPageResponse({
            orders: [buildOrderNode({ id: "gid://shopify/Order/5001", name: "#5001" })],
            hasNextPage: true,
            endCursor: "orders-resume-cursor",
          }),
        )
        .mockRejectedValueOnce(new Error("page_two_failed"));

      const result = await syncOrdersIncremental({
        storeId: STORE_ID,
        shop: SHOP,
        admin: { graphql: harness.mockAdminGraphql },
      });

      expect(result.success).toBe(false);
      expect(harness.getStore().ordersSyncCursor).toBe("orders-resume-cursor");
      expect(harness.getOrder("gid://shopify/Order/5001")).toBeDefined();
    });
  });

  describe("7. Transaction safety", () => {
    it("rolls back order and line item writes when line item create fails", async () => {
      const harness = testHarness();
      const orderNode = buildTenLineOrderNode();
      const normalizedOrder = normalizedOrderFromNode(orderNode);
      const normalizedLineItems = normalizedLineItemsFromOrder(orderNode);
      const defaultCreate = vi.mocked(harness.prismaMock.orderLineItem.create);
      let createAttempts = 0;

      defaultCreate.mockImplementation(async (args) => {
        createAttempts += 1;
        if (createAttempts === 2) {
          throw new Error("simulated_line_item_write_failure");
        }

        const lineItem = {
          id: crypto.randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date(),
          ...args.data,
        };
        harness.dbState.orderLineItems.set(
          `${lineItem.storeId}:${lineItem.shopifyLineItemId}`,
          lineItem,
        );

        if (!args.select) {
          return lineItem;
        }

        return Object.fromEntries(
          Object.keys(args.select).map((field) => [
            field,
            lineItem[field as keyof typeof lineItem],
          ]),
        );
      });

      await expect(
        prisma.$transaction(async (tx) =>
          upsertOrderWithLineItems(
            STORE_ID,
            normalizedOrder,
            normalizedLineItems.slice(0, 2),
            tx,
            false,
            2,
          ),
        ),
      ).rejects.toThrow("simulated_line_item_write_failure");

      expect(harness.dbState.orders.size).toBe(0);
      expect(harness.dbState.orderLineItems.size).toBe(0);
    });

    it("rolls back when order create fails", async () => {
      const harness = testHarness();
      const orderNode = asOrderNode(buildOrderNode());
      const normalizedOrder = normalizedOrderFromNode(orderNode);
      const normalizedLineItems = normalizedLineItemsFromOrder(orderNode);

      vi.spyOn(harness.prismaMock.order, "create").mockRejectedValueOnce(
        new Error("simulated_order_write_failure"),
      );

      await expect(
        prisma.$transaction(async (tx) =>
          upsertOrderWithLineItems(
            STORE_ID,
            normalizedOrder,
            normalizedLineItems,
            tx,
            true,
            1,
          ),
        ),
      ).rejects.toThrow("simulated_order_write_failure");

      expect(harness.dbState.orders.size).toBe(0);
      expect(harness.dbState.orderLineItems.size).toBe(0);
    });
  });

  describe("8. Webhook idempotency", () => {
    const webhookInput = {
      shop: SHOP,
      topic: "orders/create",
      webhookId: "wh-order-1",
      payload: {
        admin_graphql_api_id: ORDER_GID,
      },
    };

    function mockSuccessfulOrderWebhookGraphql() {
      testHarness().mockAdminGraphql.mockResolvedValue(
        mockOrderByIdResponse(buildOrderNode()),
      );
    }

    it("claims webhook events and marks them processed on success", async () => {
      const harness = testHarness();
      mockSuccessfulOrderWebhookGraphql();

      await handleOrderCreateWebhook(webhookInput);

      expect(harness.dbState.webhookEvents.get("wh-order-1")).toMatchObject({
        storeId: STORE_ID,
        processedSuccessfully: true,
      });
    });

    it("exits early for duplicate webhook deliveries", async () => {
      const harness = testHarness();
      const markSpy = vi.spyOn(webhookServer, "markWebhookEventProcessed");
      harness.dbState.webhookEvents.set("wh-order-dup", {
        id: "event-dup",
        storeId: STORE_ID,
        shopifyWebhookId: "wh-order-dup",
        shop: SHOP,
        topic: "orders/create",
        processedSuccessfully: true,
        processedAt: new Date(),
        createdAt: new Date(),
      });
      harness.dbState.webhookEventsById.set("event-dup", {
        id: "event-dup",
        storeId: STORE_ID,
        shopifyWebhookId: "wh-order-dup",
        shop: SHOP,
        topic: "orders/create",
        processedSuccessfully: true,
        processedAt: new Date(),
        createdAt: new Date(),
      });

      const result = await handleOrderUpdatedWebhook({
        ...webhookInput,
        topic: "orders/updated",
        webhookId: "wh-order-dup",
      });

      expect(result.skipped).toBe(true);
      expect(markSpy).not.toHaveBeenCalled();
      expect(harness.mockAdminGraphql).not.toHaveBeenCalled();
    });

    it("does not mark processed when webhook processing throws", async () => {
      const harness = testHarness();
      harness.mockAdminGraphql.mockRejectedValue(
        new Error("graphql_down"),
      );

      await expect(
        handleOrderCancelledWebhook({
          ...webhookInput,
          topic: "orders/cancelled",
          webhookId: "wh-order-throw-unique",
        }),
      ).rejects.toThrow("graphql_down");

      expect(
        harness.dbState.webhookEvents.get("wh-order-throw-unique")
          ?.processedSuccessfully,
      ).toBe(false);
    }, 10000);
  });

  describe("9. Line item pagination (F.0.1)", () => {
    it("loads additional line-item pages for orders with more than 250 items", async () => {
      const harness = testHarness();
      const paginatedOrder = buildOrderNode({
        id: ORDER_GID_PAGINATED,
        name: "#2001",
        lineItems: {
          edges: buildLineItemEdges(250),
          pageInfo: {
            hasNextPage: true,
            endCursor: "li-page-2",
          },
        },
      });

      harness.mockAdminGraphql
        .mockResolvedValueOnce(mockOrderByIdResponse(paginatedOrder))
        .mockResolvedValueOnce(
          mockOrderLineItemsPageResponse({
            edges: [
              { node: buildLineItemNode(251) },
              { node: buildLineItemNode(252) },
              { node: buildLineItemNode(253) },
              { node: buildLineItemNode(254) },
              { node: buildLineItemNode(255) },
            ],
            hasNextPage: false,
            endCursor: null,
          }),
        );

      const order = await fetchOrderById(
        { graphql: harness.mockAdminGraphql },
        SHOP,
        STORE_ID,
        ORDER_GID_PAGINATED,
      );

      expect(harness.mockAdminGraphql).toHaveBeenCalledTimes(2);
      expect(order?.lineItems?.edges).toHaveLength(255);
    });

    it("skips sync writes when line-item pagination fails", async () => {
      const harness = testHarness();
      harness.mockAdminGraphql
        .mockResolvedValueOnce(
          mockOrdersSyncPageResponse({
            orders: [
              buildOrderNode({
                id: ORDER_GID_PAGINATED,
                name: "#2001",
                lineItems: {
                  edges: buildLineItemEdges(250),
                  pageInfo: {
                    hasNextPage: true,
                    endCursor: "li-page-2",
                  },
                },
              }),
            ],
          }),
        )
        .mockResolvedValueOnce(mockGraphqlErrorResponse("line item page failed"));

      const deleteManySpy = vi.spyOn(harness.prismaMock.orderLineItem, "deleteMany");

      await syncOrdersFromShopify({
        storeId: STORE_ID,
        shop: SHOP,
        admin: { graphql: harness.mockAdminGraphql },
      });

      expect(harness.getOrder(ORDER_GID_PAGINATED)).toBeUndefined();
      expect(harness.dbState.orders.size).toBe(0);
      expect(deleteManySpy).not.toHaveBeenCalled();
    });
  });
});
