import { beforeEach, describe, expect, it, vi } from "vitest";

import prisma from "../../db.server";
import { createTrialSubscription } from "../billing.server";
import {
  getCustomerDataExportById,
  handleCustomersDataRequestWebhook,
} from "../gdpr.server";
import {
  parseOrdersSyncCursorState,
  syncOrdersFromShopify,
} from "../orders.server";
import { handleAppUninstalledWebhook } from "../store.server";
import {
  ORDER_GID,
  SHOP,
  STORE_ID,
  buildOrderNode,
  mockOrdersSyncPageResponse,
  testHarness,
} from "./helpers/fixtures";

const CUSTOMER_ID = "191167";
const REQUESTED_ORDER_GID = "gid://shopify/Order/299938";

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

beforeEach(() => {
  const harness = testHarness();
  harness.resetDbState();
  vi.clearAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("F.6.16 C1 — stale uninstall protection", () => {
  it("1. fresh uninstall deactivates store", async () => {
    const harness = testHarness();
    harness.getStore().lastAuthenticatedAt = new Date("2026-06-01T10:00:00.000Z");
    harness.dbState.sessions.push({ id: "session-uninstall", shop: SHOP });

    const result = await handleAppUninstalledWebhook({
      shop: SHOP,
      topic: "app/uninstalled",
      webhookId: "wh-f616-uninstall-fresh",
      webhookTriggeredAt: new Date("2026-06-01T11:00:00.000Z"),
    });

    expect(result).toEqual({ success: true });
    expect(harness.getStore().active).toBe(false);
    expect(harness.getStore().accessToken).toBe("");
    expect(harness.dbState.sessions).toHaveLength(0);
    expect(console.info).toHaveBeenCalledWith(
      "[store-deactivate]",
      expect.objectContaining({ operation: "uninstall_processed" }),
    );
  });

  it("2. duplicate uninstall remains idempotent", async () => {
    const processedEvent = {
      id: "event-uninstall-dup-f616",
      storeId: STORE_ID,
      shopifyWebhookId: "wh-f616-uninstall-dup",
      shop: SHOP,
      topic: "app/uninstalled",
      processedSuccessfully: true,
      processedAt: new Date(),
      createdAt: new Date(),
    };
    testHarness().dbState.webhookEvents.set(
      "wh-f616-uninstall-dup",
      processedEvent,
    );
    testHarness().dbState.webhookEventsById.set(
      "event-uninstall-dup-f616",
      processedEvent,
    );

    const result = await handleAppUninstalledWebhook({
      shop: SHOP,
      topic: "app/uninstalled",
      webhookId: "wh-f616-uninstall-dup",
      webhookTriggeredAt: new Date("2026-06-01T11:00:00.000Z"),
    });

    expect(result).toEqual({ success: true, duplicate: true });
  });

  it("3. reinstall then stale uninstall is ignored", async () => {
    const harness = testHarness();
    harness.getStore().active = true;
    harness.getStore().accessToken = "restored-token";
    harness.getStore().lastAuthenticatedAt = new Date("2026-06-02T12:00:00.000Z");

    const result = await handleAppUninstalledWebhook({
      shop: SHOP,
      topic: "app/uninstalled",
      webhookId: "wh-f616-uninstall-stale",
      webhookTriggeredAt: new Date("2026-06-01T11:00:00.000Z"),
    });

    expect(result).toEqual({ success: true, stale: true });
    expect(harness.getStore().active).toBe(true);
    expect(harness.getStore().accessToken).toBe("restored-token");
    expect(console.info).toHaveBeenCalledWith(
      "[store-deactivate]",
      expect.objectContaining({ operation: "stale_uninstall_ignored" }),
    );
  });

  it("4. subscription remains active after stale uninstall", async () => {
    const harness = testHarness();
    await createTrialSubscription(STORE_ID, "starter");
    harness.getStore().lastAuthenticatedAt = new Date("2026-06-02T12:00:00.000Z");

    await handleAppUninstalledWebhook({
      shop: SHOP,
      topic: "app/uninstalled",
      webhookId: "wh-f616-uninstall-stale-sub",
      webhookTriggeredAt: new Date("2026-06-01T11:00:00.000Z"),
    });

    const subscription = await prisma.subscription.findUnique({
      where: { storeId: STORE_ID },
    });
    expect(subscription?.status).toBe("trialing");
    expect(subscription?.endedAt).toBeNull();
  });

  it("5. sessions remain intact after stale uninstall", async () => {
    const harness = testHarness();
    harness.dbState.sessions.push({ id: "session-reinstall", shop: SHOP });
    harness.getStore().lastAuthenticatedAt = new Date("2026-06-02T12:00:00.000Z");

    await handleAppUninstalledWebhook({
      shop: SHOP,
      topic: "app/uninstalled",
      webhookId: "wh-f616-uninstall-stale-sessions",
      webhookTriggeredAt: new Date("2026-06-01T11:00:00.000Z"),
    });

    expect(harness.dbState.sessions).toHaveLength(1);
    expect(harness.dbState.sessions[0]?.id).toBe("session-reinstall");
  });
});

describe("F.6.16 C2 — historical orders cursor safety", () => {
  it("1. skipped order advances cursor while quarantining the order", async () => {
    const harness = testHarness();
    harness.getStore().ordersSyncCursor = "historical-start-cursor";
    harness.mockAdminGraphql
      .mockResolvedValueOnce(
        mockOrdersSyncPageResponse({
          orders: [
            buildOrderNode(),
            buildOrderNode({
              id: "gid://shopify/Order/1002",
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
          orders: [],
        }),
      );

    await syncOrdersFromShopify({
      storeId: STORE_ID,
      shop: SHOP,
      admin: { graphql: harness.mockAdminGraphql },
    });

    const syncState = parseOrdersSyncCursorState(harness.getStore().ordersSyncCursor);
    expect(syncState.pageCursor).toBeNull();
    expect(syncState.historicalPagesComplete).toBe(true);
    expect(syncState.quarantinedOrderIds).toContain("gid://shopify/Order/1002");
  });

  it("2. skipped order does not stop pagination", async () => {
    const harness = testHarness();
    harness.mockAdminGraphql
      .mockResolvedValueOnce(
        mockOrdersSyncPageResponse({
          orders: [
            buildOrderNode(),
            buildOrderNode({
              id: "gid://shopify/Order/1002",
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
  });

  it("3. success=false when skipped exists", async () => {
    const harness = testHarness();
    harness.mockAdminGraphql.mockResolvedValue(
      mockOrdersSyncPageResponse({
        orders: [
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
  });

  it("4. historicalOrdersImportDone remains false", async () => {
    const harness = testHarness();
    harness.mockAdminGraphql.mockResolvedValue(
      mockOrdersSyncPageResponse({
        orders: [
          buildOrderNode({
            id: "gid://shopify/Order/1002",
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

    expect(harness.getStore().historicalOrdersImportDone).toBe(false);
    expect(harness.getStore().lastOrdersSyncAt).toBeNull();
  });

  it("5. clean multi-page import still advances correctly", async () => {
    const harness = testHarness();
    harness.mockAdminGraphql
      .mockResolvedValueOnce(
        mockOrdersSyncPageResponse({
          orders: [buildOrderNode({ id: ORDER_GID, name: "#1001" })],
          hasNextPage: true,
          endCursor: "historical-page-2",
        }),
      )
      .mockResolvedValueOnce(
        mockOrdersSyncPageResponse({
          orders: [
            buildOrderNode({
              id: "gid://shopify/Order/1002",
              name: "#1002",
            }),
          ],
        }),
      );

    const result = await syncOrdersFromShopify({
      storeId: STORE_ID,
      shop: SHOP,
      admin: { graphql: harness.mockAdminGraphql },
    });

    expect(result.success).toBe(true);
    expect(result.orderPages).toBe(2);
    expect(harness.mockAdminGraphql).toHaveBeenCalledTimes(2);
  });

  it("6. successful completion clears cursor", async () => {
    const harness = testHarness();
    harness.getStore().ordersSyncCursor = "historical-resume-cursor";
    harness.mockAdminGraphql.mockResolvedValue(
      mockOrdersSyncPageResponse({
        orders: [buildOrderNode()],
      }),
    );

    await syncOrdersFromShopify({
      storeId: STORE_ID,
      shop: SHOP,
      admin: { graphql: harness.mockAdminGraphql },
    });

    expect(harness.getStore().ordersSyncCursor).toBeNull();
    expect(harness.getStore().historicalOrdersImportDone).toBe(true);
    expect(harness.getStore().lastOrdersSyncAt).toBeInstanceOf(Date);
  });
});

describe("F.6.16 C3 — GDPR customer data export delivery", () => {
  it("1. export persisted", async () => {
    const harness = testHarness();
    harness.seedOrder({
      shopifyOrderId: REQUESTED_ORDER_GID,
      orderName: "#299938",
    });

    const result = await handleCustomersDataRequestWebhook({
      shop: SHOP,
      topic: "customers/data_request",
      webhookId: "wh-f616-gdpr-persist",
      payload: buildCustomerPayload(),
    });

    expect(result.exportReference).toBeTruthy();
    const persisted = await prisma.customerDataExport.findUnique({
      where: {
        storeId_shopifyWebhookId: {
          storeId: STORE_ID,
          shopifyWebhookId: "wh-f616-gdpr-persist",
        },
      },
    });
    expect(persisted?.id).toBe(result.exportReference);
    expect(persisted?.exportPayload).toEqual(result.export);
  });

  it("2. duplicate request idempotent", async () => {
    const harness = testHarness();
    harness.seedOrder({ shopifyOrderId: REQUESTED_ORDER_GID });

    const first = await handleCustomersDataRequestWebhook({
      shop: SHOP,
      topic: "customers/data_request",
      webhookId: "wh-f616-gdpr-dup",
      payload: buildCustomerPayload(),
    });

    const second = await handleCustomersDataRequestWebhook({
      shop: SHOP,
      topic: "customers/data_request",
      webhookId: "wh-f616-gdpr-dup",
      payload: buildCustomerPayload(),
    });

    expect(second.skipped).toBe(true);
    expect(second.exportReference).toBe(first.exportReference);
    expect(harness.dbState.customerDataExports.size).toBe(1);
  });

  it("3. export retrievable", async () => {
    const harness = testHarness();
    harness.seedOrder({ shopifyOrderId: REQUESTED_ORDER_GID });

    const result = await handleCustomersDataRequestWebhook({
      shop: SHOP,
      topic: "customers/data_request",
      webhookId: "wh-f616-gdpr-retrieve",
      payload: buildCustomerPayload(),
    });

    const retrieved = await getCustomerDataExportById(result.exportReference!);
    expect(retrieved).toEqual(result.export);
  });

  it("4. no PII logged", async () => {
    const harness = testHarness();
    harness.seedOrder({ shopifyOrderId: REQUESTED_ORDER_GID });

    await handleCustomersDataRequestWebhook({
      shop: SHOP,
      topic: "customers/data_request",
      webhookId: "wh-f616-gdpr-no-pii",
      payload: buildCustomerPayload(),
    });

    expectNoPiiLogged();
  });

  it("5. missing store handled safely", async () => {
    const harness = testHarness();
    harness.dbState.stores.length = 0;

    const result = await handleCustomersDataRequestWebhook({
      shop: SHOP,
      topic: "customers/data_request",
      webhookId: "wh-f616-gdpr-no-store",
      payload: buildCustomerPayload(),
    });

    expect(result.success).toBe(true);
    expect(result.export?.storeId).toBeNull();
    expect(harness.dbState.customerDataExports.size).toBe(0);
  });

  it("6. repeated webhook returns same export reference", async () => {
    const harness = testHarness();
    harness.seedOrder({ shopifyOrderId: REQUESTED_ORDER_GID });

    const first = await handleCustomersDataRequestWebhook({
      shop: SHOP,
      topic: "customers/data_request",
      webhookId: "wh-f616-gdpr-repeat",
      payload: buildCustomerPayload(),
    });

    const second = await handleCustomersDataRequestWebhook({
      shop: SHOP,
      topic: "customers/data_request",
      webhookId: "wh-f616-gdpr-repeat",
      payload: buildCustomerPayload(),
    });

    expect(first.exportReference).toBeTruthy();
    expect(second.exportReference).toBe(first.exportReference);
    expect(second.export).toEqual(first.export);
  });
});
