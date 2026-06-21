export const STORE_ID = "store-test-001";
export const SHOP = "storepilot-test.myshopify.com";
export const PRODUCT_GID = "gid://shopify/Product/789";
export const VARIANT_GID = "gid://shopify/ProductVariant/456";
export const INVENTORY_ITEM_GID = "gid://shopify/InventoryItem/123";

export function mockInventoryGraphqlResponse(input: {
  tracked: boolean;
  totalAvailable: number;
  inventoryItemId?: string;
  variantId?: string;
}): Response {
  return Response.json({
    data: {
      inventoryItem: {
        id: input.inventoryItemId ?? INVENTORY_ITEM_GID,
        tracked: input.tracked,
        variant: { id: input.variantId ?? VARIANT_GID },
        inventoryLevels: {
          nodes: [{ quantities: [{ quantity: input.totalAvailable }] }],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    },
  });
}

export function mockProductsSyncGraphqlResponse(input: {
  inventoryQuantity: number;
  tracked?: boolean;
}): Response {
  return Response.json({
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
                  {
                    node: {
                      id: VARIANT_GID,
                      sku: "SKU-1",
                      price: "19.99",
                      inventoryQuantity: input.inventoryQuantity,
                      inventoryItem: {
                        id: INVENTORY_ITEM_GID,
                        tracked: input.tracked ?? true,
                      },
                    },
                  },
                ],
                pageInfo: { hasNextPage: false },
              },
            },
          },
        ],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    },
  });
}

export function testHarness() {
  return globalThis.__D7_TEST__;
}
