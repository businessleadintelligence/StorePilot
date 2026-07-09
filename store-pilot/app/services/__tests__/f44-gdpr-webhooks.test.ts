import { beforeEach, describe, expect, it, vi } from "vitest";

import prisma from "../../db.server";
import { hashIdentifierForLog } from "../../lib/privacy-by-architecture";
import { SHOP, STORE_ID, testHarness } from "./helpers/fixtures";
import {
  handleCustomersDataRequestWebhook,
  handleCustomersRedactWebhook,
  handleShopRedactWebhook,
} from "../gdpr.server";
import * as webhookServer from "../webhook.server";

const CUSTOMER_ID = "191167";

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

function buildShopRedactPayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    shop_id: 954889,
    shop_domain: SHOP,
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
    expect(serialized).not.toContain(`"shopifyCustomerId":"${CUSTOMER_ID}"`);
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

describe("F.4.4 GDPR Webhook Service Handlers", () => {
  it("1. acknowledges a valid customer data request", async () => {
    const result = await handleCustomersDataRequestWebhook({
      shop: SHOP,
      topic: "customers/data_request",
      webhookId: "wh-gdpr-data-1",
      payload: buildCustomerPayload(),
    });

    expect(result).toMatchObject({
      success: true,
      action: "customer_data_exported",
      shopifyCustomerId: CUSTOMER_ID,
      storeId: STORE_ID,
    });
    expect(result.export?.storedCustomerProfile.email).toBe(false);
    expect(console.info).toHaveBeenCalledWith(
      "[gdpr-webhook]",
      expect.objectContaining({ operation: "gdpr_data_request_received" }),
    );
    expect(console.info).toHaveBeenCalledWith(
      "[gdpr-webhook]",
      expect.objectContaining({
        operation: "customer_data_request_processed",
        customerIdHash: hashIdentifierForLog(CUSTOMER_ID),
        action: "customer_data_exported",
      }),
    );
    expectNoPiiLogged();
  });

  it("2. acknowledges a valid customer redact request", async () => {
    const result = await handleCustomersRedactWebhook({
      shop: SHOP,
      topic: "customers/redact",
      webhookId: "wh-gdpr-customer-1",
      payload: buildCustomerRedactPayload(),
    });

    expect(result).toMatchObject({
      success: true,
      action: "customer_redacted",
      shopifyCustomerId: CUSTOMER_ID,
      storeId: STORE_ID,
    });
    expect(console.info).toHaveBeenCalledWith(
      "[gdpr-webhook]",
      expect.objectContaining({ operation: "customer_redacted" }),
    );
    expectNoPiiLogged();
  });

  it("3. deletes all merchant store data on shop redact", async () => {
    const harness = testHarness();
    harness.dbState.products.set("product-1", {
      id: "product-1",
      storeId: STORE_ID,
      shopifyProductId: "gid://shopify/Product/1",
      shopifyVariantId: "gid://shopify/ProductVariant/1",
      shopifyInventoryItemId: null,
      title: "Delete Product",
      sku: null,
      status: "active",
      price: null,
      inventoryQuantity: 1,
      inventoryTracked: false,
      shopifyProductUpdatedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    harness.dbState.orders.set(`${STORE_ID}:gid://shopify/Order/1`, {
      id: "order-1",
      storeId: STORE_ID,
      shopifyOrderId: "gid://shopify/Order/1",
      orderName: "#1",
      shopifyCreatedAt: new Date(),
      shopifyUpdatedAt: new Date(),
      processedAt: new Date(),
      cancelledAt: null,
      metricDate: new Date(),
      displayFinancialStatus: "paid",
      currencyCode: "USD",
      subtotalAmount: null,
      totalTaxAmount: null,
      totalDiscountAmount: null,
      totalPriceAmount: null,
      totalRefundedAmount: null,
      isTest: false,
      isPaid: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    harness.dbState.subscriptions.set(STORE_ID, {
      id: "sub-1",
      storeId: STORE_ID,
      planId: "plan-starter",
      status: "trialing",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(),
      trialEndsAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    harness.dbState.sessions.push({
      id: "session-1",
      shop: SHOP,
    });

    const result = await handleShopRedactWebhook({
      shop: SHOP,
      topic: "shop/redact",
      webhookId: "wh-gdpr-shop-1",
      payload: buildShopRedactPayload(),
    });

    expect(result).toEqual({
      success: true,
      action: "shop_redacted",
      storeId: STORE_ID,
    });

    expect(harness.dbState.stores).toHaveLength(0);
    expect(harness.dbState.products.size).toBe(0);
    expect(harness.dbState.orders.size).toBe(0);
    expect(harness.dbState.subscriptions.size).toBe(0);
    expect(harness.dbState.sessions).toHaveLength(0);
    expect(console.info).toHaveBeenCalledWith(
      "[gdpr-webhook]",
      expect.objectContaining({ operation: "shop_redacted", storeId: STORE_ID }),
    );
  });

  it("3b. deletes integrations and AI data on shop redact", async () => {
    const harness = testHarness();
    harness.dbState.googleIntegrations.set(STORE_ID, {
      id: "google-1",
      storeId: STORE_ID,
      googleAccountId: "ga-1",
      email: "merchant@store.com",
      refreshToken: "encrypted-refresh",
      accessToken: "encrypted-access",
      expiresAt: new Date(Date.now() + 3600_000),
      connectedAt: new Date(),
      lastSyncAt: null,
      analyticsPropertyId: null,
      analyticsPropertyName: null,
      searchConsoleSiteUrl: null,
      searchConsoleSiteName: null,
      searchConsoleLastSyncAt: null,
      pageSpeedLastSyncAt: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    harness.dbState.microsoftClarityIntegrations.set(STORE_ID, {
      id: "clarity-1",
      storeId: STORE_ID,
      projectId: "clarity-project",
      projectName: "Store",
      apiToken: "encrypted-token",
      connectedAt: new Date(),
      lastSyncAt: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await handleShopRedactWebhook({
      shop: SHOP,
      topic: "shop/redact",
      webhookId: "wh-gdpr-shop-integrations",
      payload: buildShopRedactPayload(),
    });

    expect(result.action).toBe("shop_redacted");
    expect(harness.dbState.stores).toHaveLength(0);
    expect(harness.dbState.googleIntegrations.size).toBe(0);
    expect(harness.dbState.microsoftClarityIntegrations.size).toBe(0);
    expect(prisma.aiRecommendation.deleteMany).toHaveBeenCalledWith({
      where: { storeId: STORE_ID },
    });
    expect(prisma.aiAgentRun.deleteMany).toHaveBeenCalledWith({
      where: { storeId: STORE_ID },
    });
    expect(prisma.googleIntegration.deleteMany).toHaveBeenCalledWith({
      where: { storeId: STORE_ID },
    });
    expect(prisma.microsoftClarityIntegration.deleteMany).toHaveBeenCalledWith({
      where: { storeId: STORE_ID },
    });
  });

  it("4. rejects customer webhooks with missing payload fields", async () => {
    await expect(
      handleCustomersDataRequestWebhook({
        shop: SHOP,
        topic: "customers/data_request",
        webhookId: "wh-gdpr-invalid-data",
        payload: { shop_domain: SHOP },
      }),
    ).rejects.toThrow("missing_customer");

    await expect(
      handleCustomersRedactWebhook({
        shop: SHOP,
        topic: "customers/redact",
        webhookId: "wh-gdpr-invalid-redact",
        payload: { shop_domain: SHOP, customer: {} },
      }),
    ).rejects.toThrow("missing_customer_id");
  });

  it("5. returns store_not_found for shop redact when store is missing", async () => {
    const result = await handleShopRedactWebhook({
      shop: "missing-shop.myshopify.com",
      topic: "shop/redact",
      webhookId: "wh-gdpr-shop-missing",
      payload: buildShopRedactPayload({
        shop_domain: "missing-shop.myshopify.com",
      }),
    });

    expect(result).toEqual({
      success: true,
      action: "store_not_found",
    });
  });

  it("6. skips duplicate GDPR webhook deliveries", async () => {
    const harness = testHarness();
    const processedEvent = {
      id: "event-gdpr-dup",
      storeId: STORE_ID,
      shopifyWebhookId: "wh-gdpr-dup",
      shop: SHOP,
      topic: "customers/data_request",
      processedSuccessfully: true,
      processedAt: new Date(),
      createdAt: new Date(),
    };
    harness.dbState.webhookEvents.set("wh-gdpr-dup", processedEvent);
    harness.dbState.webhookEventsById.set("event-gdpr-dup", processedEvent);

    const markSpy = vi.spyOn(webhookServer, "markWebhookEventProcessed");

    const result = await handleCustomersDataRequestWebhook({
      shop: SHOP,
      topic: "customers/data_request",
      webhookId: "wh-gdpr-dup",
      payload: buildCustomerPayload(),
    });

    expect(result).toEqual({
      success: true,
      action: "customer_data_exported",
      skipped: true,
    });
    expect(markSpy).not.toHaveBeenCalled();
  });

  it("7. acknowledges customer GDPR webhooks even when store is missing", async () => {
    const result = await handleCustomersDataRequestWebhook({
      shop: "missing-shop.myshopify.com",
      topic: "customers/data_request",
      webhookId: "wh-gdpr-data-no-store",
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
  });

  it("8. rejects shop redact when shop_domain is missing", async () => {
    await expect(
      handleShopRedactWebhook({
        shop: SHOP,
        topic: "shop/redact",
        webhookId: "wh-gdpr-shop-invalid",
        payload: { shop_id: 954889 },
      }),
    ).rejects.toThrow("missing_shop_domain");
  });
});
