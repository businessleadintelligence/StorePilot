import { beforeEach, describe, expect, it, vi } from "vitest";

import prisma from "../../db.server";
import {
  REDACTED_ORDER_NAME,
  gatherCustomerDataExport,
  handleCustomersRedactWebhook,
  redactCustomerOrders,
} from "../gdpr.server";
import {
  parseOrdersSyncCursorState,
  syncOrdersFromShopify,
} from "../orders.server";
import {
  WEBHOOK_PROCESSING_LEASE_MS_EXPORT,
  WebhookLeaseOwnershipError,
  claimWebhookEvent,
  finalizeWebhookClaim,
  markWebhookEventProcessed,
} from "../webhook.server";
import {
  ORDER_GID,
  SHOP,
  STORE_ID,
  buildOrderNode,
  mockOrderByIdResponse,
  mockOrdersSyncPageResponse,
  testHarness,
} from "./helpers/fixtures";

const BAD_ORDER_GID = "gid://shopify/Order/1002";
const CUSTOMER_ID = "191167";

beforeEach(() => {
  const harness = testHarness();
  harness.resetDbState();
  vi.clearAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("F.6.20 C1 — webhook lease ownership enforcement", () => {
  const claimInput = {
    storeId: STORE_ID,
    shop: SHOP,
    topic: "orders/create",
    webhookId: "wh-f620-lease-ownership",
  };

  it("1. stale worker finalize fails after lease reclaim", async () => {
    const workerA = await claimWebhookEvent(claimInput);
    expect(workerA.status).toBe("claimed");
    expect(workerA.eventId).toBeTruthy();
    expect(workerA.processingOwner).toBeTruthy();

    const workerAOwner = workerA.processingOwner!;
    const eventId = workerA.eventId!;

    await prisma.webhookEvent.updateMany({
      where: { id: eventId },
      data: { processingExpiresAt: new Date(Date.now() - 1_000) },
    });

    const workerB = await claimWebhookEvent(claimInput);
    expect(workerB.status).toBe("claimed");
    expect(workerB.processingOwner).not.toBe(workerAOwner);

    await expect(
      markWebhookEventProcessed(eventId, workerAOwner),
    ).rejects.toBeInstanceOf(WebhookLeaseOwnershipError);

    await markWebhookEventProcessed(eventId, workerB.processingOwner!);

    const event = await prisma.webhookEvent.findUnique({ where: { id: eventId } });
    expect(event?.processedSuccessfully).toBe(true);
    expect(event?.processingOwner).toBeNull();
  });

  it("2. duplicate finalize cannot mark processed by non-owner", async () => {
    const first = await claimWebhookEvent({
      ...claimInput,
      webhookId: "wh-f620-duplicate-finalize",
    });
    const eventId = first.eventId!;
    const firstOwner = first.processingOwner!;

    await prisma.webhookEvent.updateMany({
      where: { id: eventId },
      data: { processingExpiresAt: new Date(Date.now() - 1_000) },
    });

    const second = await claimWebhookEvent({
      ...claimInput,
      webhookId: "wh-f620-duplicate-finalize",
    });

    await markWebhookEventProcessed(eventId, second.processingOwner!);

    await expect(
      markWebhookEventProcessed(eventId, firstOwner),
    ).resolves.toBeUndefined();

    const event = await prisma.webhookEvent.findUnique({ where: { id: eventId } });
    expect(event?.processedSuccessfully).toBe(true);
    expect(event?.processedAt).toBeInstanceOf(Date);
  });

  it("3. retry path preserves lease correctness", async () => {
    const claim = await claimWebhookEvent({
      ...claimInput,
      webhookId: "wh-f620-retry-release",
    });

    await finalizeWebhookClaim(claim.eventId, false, claim.processingOwner);

    const released = await prisma.webhookEvent.findUnique({
      where: { id: claim.eventId },
    });
    expect(released?.processedSuccessfully).toBe(false);
    expect(released?.processingOwner).toBeNull();
    expect(released?.processingExpiresAt).toBeNull();

    const reclaim = await claimWebhookEvent({
      ...claimInput,
      webhookId: "wh-f620-retry-release",
    });
    expect(reclaim.status).toBe("claimed");
    expect(reclaim.processingOwner).toBeTruthy();
    expect(WEBHOOK_PROCESSING_LEASE_MS_EXPORT).toBeGreaterThan(0);
  });
});

describe("F.6.20 C2 — historical orders pagination deadlock", () => {
  it("1. bad order on page 1 still allows page 2 import", async () => {
    const harness = testHarness();
    harness.mockAdminGraphql
      .mockResolvedValueOnce(
        mockOrdersSyncPageResponse({
          orders: [
            buildOrderNode(),
            buildOrderNode({
              id: BAD_ORDER_GID,
              name: "#1002",
              processedAt: null,
            }),
          ],
          hasNextPage: true,
          endCursor: "historical-page-2",
        }),
      )
      .mockResolvedValueOnce(
        mockOrdersSyncPageResponse({
          orders: [
            buildOrderNode({
              id: "gid://shopify/Order/1003",
              name: "#1003",
            }),
          ],
        }),
      );

    const result = await syncOrdersFromShopify({
      storeId: STORE_ID,
      shop: SHOP,
      admin: { graphql: harness.mockAdminGraphql },
    });

    expect(result.orderPages).toBe(2);
    expect(harness.mockAdminGraphql).toHaveBeenCalledTimes(2);
    expect(result.upserted).toBeGreaterThanOrEqual(2);
    expect(result.quarantinedOrderIds).toContain(BAD_ORDER_GID);
  });

  it("2. historical import completes despite skipped order", async () => {
    const harness = testHarness();
    harness.mockAdminGraphql.mockResolvedValue(
      mockOrdersSyncPageResponse({
        orders: [
          buildOrderNode({
            id: BAD_ORDER_GID,
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
    expect(result.quarantinedOrderIds).toContain(BAD_ORDER_GID);

    const syncState = parseOrdersSyncCursorState(harness.getStore().ordersSyncCursor);
    expect(syncState.historicalPagesComplete).toBe(true);
    expect(syncState.quarantinedOrderIds).toContain(BAD_ORDER_GID);
    expect(harness.getStore().historicalOrdersImportDone).toBe(false);
  });

  it("3. skipped order remains visible for retry/review", async () => {
    const harness = testHarness();
    harness.mockAdminGraphql.mockResolvedValue(
      mockOrdersSyncPageResponse({
        orders: [
          buildOrderNode({
            id: BAD_ORDER_GID,
            name: "#1002",
            processedAt: null,
          }),
        ],
      }),
    );

    await syncOrdersFromShopify({
      storeId: STORE_ID,
      shop: SHOP,
      admin: { graphql: harness.mockAdminGraphql },
    });

    const syncState = parseOrdersSyncCursorState(harness.getStore().ordersSyncCursor);
    expect(syncState.quarantinedOrderIds).toEqual([BAD_ORDER_GID]);
  });

  it("4. no duplicate imports when retrying quarantined order", async () => {
    const harness = testHarness();
    const quarantineState = `sp-sync:v1:${JSON.stringify({
      pageCursor: null,
      quarantinedOrderIds: [ORDER_GID],
      historicalPagesComplete: true,
    })}`;
    harness.getStore().ordersSyncCursor = quarantineState;
    harness.seedOrder({
      shopifyOrderId: ORDER_GID,
      orderName: "#1001",
      shopifyUpdatedAt: new Date("2026-01-15T10:00:00Z"),
    });

    harness.mockAdminGraphql.mockResolvedValue(
      mockOrderByIdResponse(
        buildOrderNode({
          id: ORDER_GID,
          name: "#1001",
          updatedAt: "2026-06-20T12:00:00Z",
        }),
      ),
    );

    const ordersBefore = await prisma.order.count({ where: { storeId: STORE_ID } });

    const result = await syncOrdersFromShopify({
      storeId: STORE_ID,
      shop: SHOP,
      admin: { graphql: harness.mockAdminGraphql },
    });

    const ordersAfter = await prisma.order.count({ where: { storeId: STORE_ID } });

    expect(ordersAfter).toBe(ordersBefore);
    expect(harness.mockAdminGraphql).toHaveBeenCalledTimes(1);
    expect(result.quarantinedOrderIds).toEqual([]);
    expect(harness.getStore().ordersSyncCursor).toBeNull();
    expect(harness.getStore().historicalOrdersImportDone).toBe(true);
  });
});

describe("F.6.20 C3 — GDPR customer financial redact", () => {
  const orderGid = "gid://shopify/Order/299938";

  function seedRedactableOrder() {
    const harness = testHarness();
    const order = harness.seedOrder({
      shopifyOrderId: orderGid,
      orderName: "#299938",
      totalPriceAmount: "199.99",
      subtotalAmount: "180.00",
      totalTaxAmount: "15.00",
      totalDiscountAmount: "5.00",
      totalRefundedAmount: "10.00",
      displayFinancialStatus: "paid",
    });
    harness.seedOrderLineItem({
      orderId: order.id,
      shopifyLineItemId: "gid://shopify/LineItem/1",
      shopifyOrderId: orderGid,
      title: "Sensitive item",
      sku: "SECRET-SKU",
      originalUnitPrice: "99.99",
      discountedUnitPrice: "89.99",
    });
    return harness;
  }

  it("1. redacted customer data no longer exposes prohibited fields", async () => {
    seedRedactableOrder();

    await redactCustomerOrders({
      storeId: STORE_ID,
      shopifyCustomerId: CUSTOMER_ID,
      orderGids: [orderGid],
    });

    const order = testHarness().getOrder(orderGid)!;
    const lineItems = testHarness().getOrderLineItems(order.id);
    const lineItem = lineItems[0]!;

    expect(order.orderName).toBe(REDACTED_ORDER_NAME);
    expect(order.displayFinancialStatus).toBeNull();
    expect(order.privacyRedacted).toBe(true);
    expect(order.totalPriceAmount).toBe("199.99");
    expect(order.subtotalAmount).toBe("180.00");
    expect(lineItem.title).toBe("[redacted]");
    expect(lineItem.sku).toBeNull();
    expect(lineItem.privacyRedacted).toBe(true);
    expect(lineItem.originalUnitPrice).toBe("99.99");
    expect(lineItem.discountedUnitPrice).toBe("89.99");
  });

  it("2. permitted operational aggregates remain intact", async () => {
    const harness = seedRedactableOrder();
    const before = harness.getOrder(orderGid)!;

    await redactCustomerOrders({
      storeId: STORE_ID,
      shopifyCustomerId: CUSTOMER_ID,
      orderGids: [orderGid],
    });

    const order = testHarness().getOrder(orderGid)!;

    expect(order.shopifyOrderId).toBe(orderGid);
    expect(order.metricDate).toEqual(before.metricDate);
    expect(order.currencyCode).toBe(before.currencyCode);
    expect(order.isPaid).toBe(before.isPaid);
    expect(order.isTest).toBe(before.isTest);
  });

  it("3. duplicate redact remains idempotent", async () => {
    seedRedactableOrder();

    const first = await redactCustomerOrders({
      storeId: STORE_ID,
      shopifyCustomerId: CUSTOMER_ID,
      orderGids: [orderGid],
    });
    const second = await redactCustomerOrders({
      storeId: STORE_ID,
      shopifyCustomerId: CUSTOMER_ID,
      orderGids: [orderGid],
    });

    expect(first.ordersRedacted).toBe(1);
    expect(second.alreadyRedacted).toBe(true);
    expect(second.ordersRedacted).toBe(0);
    expect(second.lineItemsRedacted).toBe(0);
  });

  it("4. no PII appears in export after redact", async () => {
    seedRedactableOrder();

    await handleCustomersRedactWebhook({
      shop: SHOP,
      topic: "customers/redact",
      webhookId: "wh-f620-redact-export",
      payload: {
        shop_id: 954889,
        shop_domain: SHOP,
        customer: { id: Number(CUSTOMER_ID) },
        orders_to_redact: [299938],
      },
    });

    const exportPayload = await gatherCustomerDataExport({
      storeId: STORE_ID,
      shopifyCustomerId: CUSTOMER_ID,
      dataRequestId: null,
      orderGids: [orderGid],
    });

    expect(exportPayload.orders).toHaveLength(0);
    expect(exportPayload.orderLineItems).toHaveLength(0);
    expect(JSON.stringify(exportPayload)).not.toContain("SECRET-SKU");
    expect(JSON.stringify(exportPayload)).not.toContain("Sensitive item");
  });
});
