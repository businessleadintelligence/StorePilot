import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  PRODUCT_GID,
  SHOP,
  STORE_ID,
  VARIANT_GID,
  mockInventoryGraphqlResponse,
  mockProductsSyncGraphqlResponse,
  testHarness,
} from "./helpers/fixtures";
import {
  handleProductCreateWebhook,
  handleProductDeleteWebhook,
  handleProductUpdateWebhook,
  normalizeVariantRow,
  normalizeWebhookVariantRow,
  syncProductsFromShopify,
  upsertVariantRow,
} from "../product.server";
import { handleInventoryLevelUpdateWebhook } from "../inventory.server";

const productNode = {
  id: PRODUCT_GID,
  title: "Test Product",
  status: "ACTIVE",
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

const webhookPayload = {
  admin_graphql_api_id: PRODUCT_GID,
  title: "Test Product",
  status: "active",
  variants: [
    {
      admin_graphql_api_id: VARIANT_GID,
      inventory_item_id: 123,
      inventory_quantity: 5,
      inventory_management: null,
      sku: "SKU-1",
      price: "19.99",
    },
  ],
};

function inventoryWebhookInput(webhookId: string) {
  return {
    shop: SHOP,
    topic: "INVENTORY_LEVELS_UPDATE",
    webhookId,
    payload: {
      inventory_item_id: 123,
      location_id: 1,
      available: 15,
    },
  };
}

beforeEach(() => {
  const harness = testHarness();
  harness.resetDbState();
  harness.mockAdminGraphql.mockReset();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("D.7.9 Critical Hardening Regression", () => {
  describe("1. Product sync create", () => {
    it("seeds inventoryQuantity and GraphQL inventoryTracked on create", async () => {
      const { mockAdminGraphql, getProduct } = testHarness();
      mockAdminGraphql.mockResolvedValueOnce(
        mockProductsSyncGraphqlResponse({
          inventoryQuantity: 8,
          tracked: true,
        }),
      );

      const result = await syncProductsFromShopify({
        storeId: STORE_ID,
        shop: SHOP,
        admin: { graphql: mockAdminGraphql },
      });

      expect(result.success).toBe(true);
      expect(result.upserted).toBe(1);

      const product = getProduct(VARIANT_GID);
      expect(product?.inventoryTracked).toBe(true);
      expect(product?.inventoryQuantity).toBe(8);
    });
  });

  describe("2. Product sync update", () => {
    it("does not overwrite inventoryQuantity for tracked variants", async () => {
      const { mockAdminGraphql, getProduct, seedProduct } = testHarness();
      seedProduct({
        shopifyVariantId: VARIANT_GID,
        inventoryTracked: true,
        inventoryQuantity: 11,
      });

      mockAdminGraphql.mockResolvedValueOnce(
        mockProductsSyncGraphqlResponse({
          inventoryQuantity: 3,
          tracked: true,
        }),
      );

      await syncProductsFromShopify({
        storeId: STORE_ID,
        shop: SHOP,
        admin: { graphql: mockAdminGraphql },
      });

      const product = getProduct(VARIANT_GID);
      expect(product?.inventoryTracked).toBe(true);
      expect(product?.inventoryQuantity).toBe(11);
    });
  });

  describe("3. Product webhook create", () => {
    it("creates tracked rows without REST inventory ownership fields", async () => {
      const { getProduct } = testHarness();
      const result = await handleProductCreateWebhook({
        shop: SHOP,
        topic: "products/create",
        webhookId: "wh-create-1",
        payload: webhookPayload,
      });

      expect(result.success).toBe(true);
      expect(result.upserted).toBe(1);

      const product = getProduct(VARIANT_GID);
      expect(product?.inventoryTracked).toBe(true);
      expect(product?.inventoryQuantity).toBeNull();
    });

    it("does not derive inventoryTracked from inventory_management", () => {
      const row = normalizeWebhookVariantRow(webhookPayload, {
        ...webhookPayload.variants![0]!,
        inventory_management: null,
      });

      expect(row).not.toHaveProperty("inventoryTracked");
    });
  });

  describe("4. Product webhook update", () => {
    it("preserves inventoryTracked and tracked inventoryQuantity", async () => {
      const { getProduct, seedProduct } = testHarness();
      seedProduct({
        shopifyVariantId: VARIANT_GID,
        inventoryTracked: true,
        inventoryQuantity: 11,
      });

      const result = await handleProductUpdateWebhook({
        shop: SHOP,
        topic: "products/update",
        webhookId: "wh-update-1",
        payload: {
          ...webhookPayload,
          title: "Updated Product Title",
          variants: [
            {
              ...webhookPayload.variants![0]!,
              inventory_quantity: 5,
              inventory_management: null,
            },
          ],
        },
      });

      expect(result.success).toBe(true);

      const product = getProduct(VARIANT_GID);
      expect(product?.inventoryTracked).toBe(true);
      expect(product?.inventoryQuantity).toBe(11);
      expect(product?.title).toBe("Updated Product Title");
    });
  });

  describe("5. Product webhook delete", () => {
    it("archives product variants by shopify product id", async () => {
      const { getProduct, seedProduct } = testHarness();
      seedProduct({ shopifyVariantId: VARIANT_GID, status: "active" });

      const result = await handleProductDeleteWebhook({
        shop: SHOP,
        topic: "products/delete",
        webhookId: "wh-delete-1",
        payload: {
          admin_graphql_api_id: PRODUCT_GID,
        },
      });

      expect(result.success).toBe(true);
      expect(result.archived).toBe(1);
      expect(getProduct(VARIANT_GID)?.status).toBe("archived");
    });
  });

  describe("6. Inventory webhook quantity update", () => {
    it("uses GraphQL recompute as authoritative quantity writer", async () => {
      const { mockAdminGraphql, getProduct, seedProduct } = testHarness();
      seedProduct({
        shopifyVariantId: VARIANT_GID,
        inventoryTracked: true,
        inventoryQuantity: 11,
      });

      mockAdminGraphql.mockResolvedValue(
        mockInventoryGraphqlResponse({
          tracked: true,
          totalAvailable: 15,
        }),
      );

      const result = await handleInventoryLevelUpdateWebhook(
        inventoryWebhookInput("wh-inventory-1"),
      );

      expect(result.success).toBe(true);
      expect(result.duplicate).toBe(false);
      expect(result.updated).toBe(1);
      expect(result.totalAvailable).toBe(15);
      expect(getProduct(VARIANT_GID)?.inventoryQuantity).toBe(15);
    });
  });

  describe("7. Inventory webhook duplicate delivery", () => {
    it("ignores duplicate webhook IDs without reprocessing", async () => {
      const { dbState, mockAdminGraphql, getProduct, seedProduct } =
        testHarness();
      seedProduct({
        shopifyVariantId: VARIANT_GID,
        inventoryTracked: true,
        inventoryQuantity: 11,
      });

      const processedEvent = {
        id: "event-1",
        storeId: STORE_ID,
        shopifyWebhookId: "wh-inventory-dup",
        shop: SHOP,
        topic: "INVENTORY_LEVELS_UPDATE",
        processedSuccessfully: true,
        processedAt: new Date(),
        createdAt: new Date(),
      };
      dbState.webhookEvents.set("wh-inventory-dup", processedEvent);
      dbState.webhookEventsById.set("event-1", processedEvent);

      const result = await handleInventoryLevelUpdateWebhook(
        inventoryWebhookInput("wh-inventory-dup"),
      );

      expect(result.success).toBe(true);
      expect(result.duplicate).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.updated).toBe(0);
      expect(mockAdminGraphql).not.toHaveBeenCalled();
      expect(getProduct(VARIANT_GID)?.inventoryQuantity).toBe(11);
    });
  });

  describe("8. inventoryTracked self-heal", () => {
    it("heals false DB flags when GraphQL tracked is true before quantity update", async () => {
      const { mockAdminGraphql, getProduct, seedProduct } = testHarness();
      seedProduct({
        shopifyVariantId: VARIANT_GID,
        inventoryTracked: false,
        inventoryQuantity: 11,
      });

      mockAdminGraphql.mockResolvedValue(
        mockInventoryGraphqlResponse({
          tracked: true,
          totalAvailable: 16,
        }),
      );

      const result = await handleInventoryLevelUpdateWebhook(
        inventoryWebhookInput("wh-inventory-heal"),
      );

      expect(result.success).toBe(true);
      expect(result.updated).toBe(1);

      const product = getProduct(VARIANT_GID);
      expect(product?.inventoryTracked).toBe(true);
      expect(product?.inventoryQuantity).toBe(16);
    });
  });

  describe("Ownership guarantees", () => {
    it("A. tracked products retain inventory ownership across sync update", async () => {
      const { getProduct, seedProduct } = testHarness();
      const row = normalizeVariantRow(productNode, trackedVariantNode);
      expect(row).not.toBeNull();

      seedProduct({
        shopifyVariantId: VARIANT_GID,
        inventoryTracked: true,
        inventoryQuantity: 11,
      });

      await upsertVariantRow(STORE_ID, row!, "sync");

      expect(getProduct(VARIANT_GID)?.inventoryQuantity).toBe(11);
      expect(getProduct(VARIANT_GID)?.inventoryTracked).toBe(true);
    });

    it("B. product webhooks never overwrite tracked inventory quantity", async () => {
      const { getProduct, seedProduct } = testHarness();
      const row = normalizeWebhookVariantRow(
        webhookPayload,
        webhookPayload.variants![0]!,
      );
      expect(row).not.toBeNull();

      seedProduct({
        shopifyVariantId: VARIANT_GID,
        inventoryTracked: true,
        inventoryQuantity: 11,
      });

      await upsertVariantRow(STORE_ID, row!, "webhook");

      expect(getProduct(VARIANT_GID)?.inventoryQuantity).toBe(11);
    });

    it("C. inventory webhook remains authoritative writer for tracked rows", async () => {
      const { mockAdminGraphql, getProduct, seedProduct } = testHarness();
      seedProduct({
        shopifyVariantId: VARIANT_GID,
        inventoryTracked: true,
        inventoryQuantity: 4,
      });

      mockAdminGraphql.mockResolvedValue(
        mockInventoryGraphqlResponse({ tracked: true, totalAvailable: 22 }),
      );

      await handleInventoryLevelUpdateWebhook(
        inventoryWebhookInput("wh-inventory-authoritative"),
      );

      expect(getProduct(VARIANT_GID)?.inventoryQuantity).toBe(22);
    });

    it("D. duplicate webhook IDs are ignored by claim logic", async () => {
      const { mockAdminGraphql, getProduct, seedProduct } = testHarness();
      seedProduct({
        shopifyVariantId: VARIANT_GID,
        inventoryTracked: true,
        inventoryQuantity: 9,
      });

      mockAdminGraphql.mockResolvedValue(
        mockInventoryGraphqlResponse({ tracked: true, totalAvailable: 50 }),
      );

      await handleInventoryLevelUpdateWebhook(
        inventoryWebhookInput("wh-inventory-once"),
      );
      expect(getProduct(VARIANT_GID)?.inventoryQuantity).toBe(50);

      const duplicate = await handleInventoryLevelUpdateWebhook(
        inventoryWebhookInput("wh-inventory-once"),
      );

      expect(duplicate.duplicate).toBe(true);
      expect(getProduct(VARIANT_GID)?.inventoryQuantity).toBe(50);
    });

    it("allows quantity writes for untracked products via webhook update", async () => {
      const { getProduct, seedProduct } = testHarness();
      seedProduct({
        shopifyVariantId: VARIANT_GID,
        inventoryTracked: false,
        inventoryQuantity: 2,
        shopifyInventoryItemId: null,
      });

      const row = normalizeWebhookVariantRow(
        {
          ...webhookPayload,
          variants: [
            {
              admin_graphql_api_id: VARIANT_GID,
              inventory_quantity: 7,
              inventory_management: null,
            },
          ],
        },
        {
          admin_graphql_api_id: VARIANT_GID,
          inventory_quantity: 7,
          inventory_management: null,
        },
      );

      await upsertVariantRow(STORE_ID, row!, "webhook");

      expect(getProduct(VARIANT_GID)?.inventoryQuantity).toBe(7);
    });
  });
});
