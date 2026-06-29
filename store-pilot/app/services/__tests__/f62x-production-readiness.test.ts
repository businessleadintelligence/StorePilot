import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildCustomerDataExportDeliveryPath,
  getCustomerDataExportForStore,
  handleCustomersDataRequestWebhook,
} from "../gdpr.server";
import { getStartupReadiness } from "../startup-readiness.server";
import { SHOP, STORE_ID, testHarness } from "./helpers/fixtures";

const REQUESTED_ORDER_GID = "gid://shopify/Order/299938";

function buildCustomerPayload() {
  return {
    shop_id: 123456789,
    shop_domain: SHOP,
    customer: {
      id: 99887766,
      email: "customer@example.com",
      phone: "+15551234567",
    },
    orders_requested: [299938],
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

describe("F.6.X — GDPR customer export merchant delivery", () => {
  it("returns a scoped delivery path when export is persisted", async () => {
    const harness = testHarness();
    harness.seedOrder({
      shopifyOrderId: REQUESTED_ORDER_GID,
      orderName: "#299938",
    });

    const result = await handleCustomersDataRequestWebhook({
      shop: SHOP,
      topic: "customers/data_request",
      webhookId: "wh-f62x-delivery-path",
      payload: buildCustomerPayload(),
    });

    expect(result.exportReference).toBeTruthy();
    expect(result.exportDeliveryPath).toBe(
      buildCustomerDataExportDeliveryPath(result.exportReference!),
    );
    expect(result.exportDeliveryPath).toBe(
      `/app/compliance/customer-export/${result.exportReference}`,
    );
  });

  it("scopes export retrieval to the owning store", async () => {
    const harness = testHarness();
    harness.seedOrder({
      shopifyOrderId: REQUESTED_ORDER_GID,
      orderName: "#299938",
    });

    const result = await handleCustomersDataRequestWebhook({
      shop: SHOP,
      topic: "customers/data_request",
      webhookId: "wh-f62x-store-scope",
      payload: buildCustomerPayload(),
    });

    const owned = await getCustomerDataExportForStore(
      result.exportReference!,
      STORE_ID,
    );
    const foreign = await getCustomerDataExportForStore(
      result.exportReference!,
      "other-store-id",
    );

    expect(owned).toEqual(result.export);
    expect(foreign).toBeNull();
  });

  it("logs delivery readiness without PII", async () => {
    const harness = testHarness();
    harness.seedOrder({ shopifyOrderId: REQUESTED_ORDER_GID });

    await handleCustomersDataRequestWebhook({
      shop: SHOP,
      topic: "customers/data_request",
      webhookId: "wh-f62x-delivery-log",
      payload: buildCustomerPayload(),
    });

    const infoCalls = vi
      .mocked(console.info)
      .mock.calls.map((call) => JSON.stringify(call));

    const deliveryLog = infoCalls.find((entry) =>
      entry.includes("customer_data_export_delivery_ready"),
    );
    expect(deliveryLog).toBeTruthy();
    expect(deliveryLog).toContain("/app/compliance/customer-export/");
    expect(deliveryLog).not.toContain("customer@example.com");
    expect(deliveryLog).not.toContain("+15551234567");
  });
});

describe("F.6.X — AI layer remains disabled in routes", () => {
  it("does not expose AI credit consumption from app routes", () => {
    const routesDir = join(process.cwd(), "app", "routes");
    const routeFiles = readdirSync(routesDir, { recursive: true })
      .filter((entry): entry is string => typeof entry === "string")
      .filter((file) => file.endsWith(".tsx") || file.endsWith(".ts"))
      .filter((file) => !file.includes("__tests__"));

    for (const file of routeFiles) {
      const source = readFileSync(join(routesDir, file), "utf8");
      expect(source).not.toMatch(/consumeAiCredits|ai-cost-control\.server/);
    }
  });
});

describe("F.6.X — production readiness checks", () => {
  it("reports green when required production env and migrations are present", async () => {
    const readiness = await getStartupReadiness({
      ...process.env,
      CRON_SECRET: "prod-cron-secret",
      SHOPIFY_API_KEY: "prod-api-key",
      DATABASE_URL: "postgresql://example",
      TOKEN_ENCRYPTION_KEY: "prod-token-encryption-key",
      SHOPIFY_APP_URL: "https://store-pilot.example.com",
      SHOPIFY_API_SECRET: "prod-api-secret",
      SCOPES: "read_products,read_inventory,write_products,read_orders",
    });

    expect(readiness.ready).toBe(true);
    expect(readiness.checks.every((check) => check.ok)).toBe(true);
  });

  it("flags missing TOKEN_ENCRYPTION_KEY", async () => {
    const readiness = await getStartupReadiness({
      CRON_SECRET: "prod-cron-secret",
      SHOPIFY_API_KEY: "prod-api-key",
      DATABASE_URL: "postgresql://example",
      SHOPIFY_APP_URL: "https://store-pilot.example.com",
      SHOPIFY_API_SECRET: "prod-api-secret",
      SCOPES: "read_products,read_inventory,write_products,read_orders",
    });

    const tokenCheck = readiness.checks.find(
      (check) => check.id === "token_encryption_key",
    );
    expect(tokenCheck?.ok).toBe(false);
    expect(readiness.ready).toBe(false);
  });
});
