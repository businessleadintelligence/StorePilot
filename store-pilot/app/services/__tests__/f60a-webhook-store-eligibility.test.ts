import { beforeEach, describe, expect, it, vi } from "vitest";

import { STORE_ID, SHOP, testHarness } from "./helpers/fixtures";
import { handleInventoryLevelUpdateWebhook } from "../inventory.server";
import { handleOrderCreateWebhook } from "../orders.server";
import {
  handleProductCreateWebhook,
  handleProductDeleteWebhook,
  handleProductUpdateWebhook,
} from "../product.server";
import {
  buildWebhookActionResponse,
  claimWebhookEvent,
} from "../webhook.server";

const productPayload = {
  id: 789,
  admin_graphql_api_id: "gid://shopify/Product/789",
  title: "Test",
  status: "active",
  variants: [],
};

beforeEach(() => {
  const harness = testHarness();
  harness.resetDbState();
  vi.clearAllMocks();
});

function setStoreActive(active: boolean) {
  testHarness().getStore().active = active;
}

function removeStore() {
  testHarness().dbState.stores = [];
}

describe("F.6.0A FIX2 Issue 3 — webhook store eligibility", () => {
  describe("products/create", () => {
    it("returns retryable for missing store and HTTP 503", async () => {
      removeStore();
      const claimSpy = vi.spyOn({ claimWebhookEvent }, "claimWebhookEvent");

      const result = await handleProductCreateWebhook({
        shop: SHOP,
        topic: "products/create",
        webhookId: "wh-product-create-missing",
        payload: productPayload,
      });

      expect(result.retryable).toBe(true);
      expect(buildWebhookActionResponse(result).status).toBe(503);
      expect(claimSpy).not.toHaveBeenCalled();
    });

    it("defers inactive store webhooks for Shopify retry with HTTP 503", async () => {
      setStoreActive(false);

      const result = await handleProductCreateWebhook({
        shop: SHOP,
        topic: "products/create",
        webhookId: "wh-product-create-inactive",
        payload: productPayload,
      });

      expect(result.success).toBe(false);
      expect(result.retryable).toBe(true);
      expect(result.reason).toBe("store_inactive");
      expect(buildWebhookActionResponse(result).status).toBe(503);
      expect(
        testHarness().dbState.webhookEvents.get("wh-product-create-inactive"),
      ).toBeUndefined();
    });
  });

  describe("products/update", () => {
    it("returns retryable for missing store", async () => {
      removeStore();

      const result = await handleProductUpdateWebhook({
        shop: SHOP,
        topic: "products/update",
        webhookId: "wh-product-update-missing",
        payload: productPayload,
      });

      expect(result.retryable).toBe(true);
      expect(buildWebhookActionResponse(result).status).toBe(503);
    });

    it("defers inactive store webhooks without claiming", async () => {
      setStoreActive(false);

      await handleProductUpdateWebhook({
        shop: SHOP,
        topic: "products/update",
        webhookId: "wh-product-update-inactive",
        payload: productPayload,
      });

      expect(
        testHarness().dbState.webhookEvents.get("wh-product-update-inactive"),
      ).toBeUndefined();
    });
  });

  describe("products/delete", () => {
    it("returns retryable for missing store", async () => {
      removeStore();

      const result = await handleProductDeleteWebhook({
        shop: SHOP,
        topic: "products/delete",
        webhookId: "wh-product-delete-missing",
        payload: { id: 789, admin_graphql_api_id: "gid://shopify/Product/789" },
      });

      expect(result.retryable).toBe(true);
      expect(buildWebhookActionResponse(result).status).toBe(503);
    });

    it("defers inactive store webhooks without finalizing", async () => {
      setStoreActive(false);

      await handleProductDeleteWebhook({
        shop: SHOP,
        topic: "products/delete",
        webhookId: "wh-product-delete-inactive",
        payload: { id: 789, admin_graphql_api_id: "gid://shopify/Product/789" },
      });

      expect(
        testHarness().dbState.webhookEvents.get("wh-product-delete-inactive"),
      ).toBeUndefined();
    });
  });

  describe("inventory_levels/update", () => {
    it("returns retryable for missing store", async () => {
      removeStore();

      const result = await handleInventoryLevelUpdateWebhook({
        shop: SHOP,
        topic: "inventory_levels/update",
        webhookId: "wh-inventory-missing",
        payload: {},
      });

      expect(result.retryable).toBe(true);
      expect(buildWebhookActionResponse(result).status).toBe(503);
    });

    it("defers inactive store webhooks for Shopify retry", async () => {
      setStoreActive(false);

      const result = await handleInventoryLevelUpdateWebhook({
        shop: SHOP,
        topic: "inventory_levels/update",
        webhookId: "wh-inventory-inactive",
        payload: {},
      });

      expect(result.success).toBe(false);
      expect(result.retryable).toBe(true);
      expect(
        testHarness().dbState.webhookEvents.get("wh-inventory-inactive"),
      ).toBeUndefined();
    });
  });

  describe("orders/create", () => {
    it("returns retryable for missing store", async () => {
      removeStore();

      const result = await handleOrderCreateWebhook({
        shop: SHOP,
        topic: "orders/create",
        webhookId: "wh-order-create-missing",
        payload: { admin_graphql_api_id: "gid://shopify/Order/1001" },
      });

      expect(result.retryable).toBe(true);
      expect(buildWebhookActionResponse(result).status).toBe(503);
    });

    it("defers inactive store webhooks for Shopify retry", async () => {
      setStoreActive(false);

      const result = await handleOrderCreateWebhook({
        shop: SHOP,
        topic: "orders/create",
        webhookId: "wh-order-create-inactive",
        payload: { admin_graphql_api_id: "gid://shopify/Order/1001" },
      });

      expect(result.success).toBe(false);
      expect(result.retryable).toBe(true);
      expect(
        testHarness().dbState.webhookEvents.get("wh-order-create-inactive"),
      ).toBeUndefined();
    });
  });
});
