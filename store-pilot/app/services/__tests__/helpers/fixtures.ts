export const STORE_ID = "store-test-001";
export const SHOP = "storepilot-test.myshopify.com";
export const PRODUCT_GID = "gid://shopify/Product/789";
export const VARIANT_GID = "gid://shopify/ProductVariant/456";
export const VARIANT_GID_2 = "gid://shopify/ProductVariant/457";
export const INVENTORY_ITEM_GID = "gid://shopify/InventoryItem/123";
export const ORDER_GID = "gid://shopify/Order/1001";
export const ORDER_GID_PAGINATED = "gid://shopify/Order/2001";

export function lineItemGid(index: number): string {
  return `gid://shopify/LineItem/${index}`;
}

export function buildOrderNode(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: ORDER_GID,
    name: "#1001",
    createdAt: "2026-01-15T10:00:00Z",
    updatedAt: "2026-01-15T10:00:00Z",
    processedAt: "2026-01-15T10:00:00Z",
    cancelledAt: null,
    displayFinancialStatus: "PAID",
    currencyCode: "USD",
    test: false,
    currentSubtotalPriceSet: { shopMoney: { amount: "100.00" } },
    currentTotalTaxSet: { shopMoney: { amount: "10.00" } },
    currentTotalDiscountsSet: { shopMoney: { amount: "5.00" } },
    currentTotalPriceSet: { shopMoney: { amount: "105.00" } },
    lineItems: {
      edges: [
        {
          node: buildLineItemNode(1),
        },
      ],
      pageInfo: { hasNextPage: false, endCursor: null },
    },
    ...overrides,
  };
}

export function buildLineItemNode(index: number): Record<string, unknown> {
  return {
    id: lineItemGid(index),
    title: `Item ${index}`,
    sku: `SKU-${index}`,
    quantity: 1,
    currentQuantity: 1,
    isGiftCard: false,
    variant: { id: VARIANT_GID },
    product: { id: PRODUCT_GID },
    originalUnitPriceSet: { shopMoney: { amount: "10.00" } },
    discountedUnitPriceSet: { shopMoney: { amount: "10.00" } },
  };
}

export function buildLineItemEdges(count: number): Array<{ node: Record<string, unknown> }> {
  return Array.from({ length: count }, (_, index) => ({
    node: buildLineItemNode(index + 1),
  }));
}

export function mockOrdersSyncPageResponse(input: {
  orders: Array<Record<string, unknown>>;
  hasNextPage?: boolean;
  endCursor?: string | null;
}): Response {
  return Response.json({
    data: {
      orders: {
        edges: input.orders.map((node) => ({ node })),
        pageInfo: {
          hasNextPage: input.hasNextPage ?? false,
          endCursor: input.endCursor ?? null,
        },
      },
    },
  });
}

export function mockOrderByIdResponse(order: Record<string, unknown>): Response {
  return Response.json({
    data: {
      order,
    },
  });
}

export function mockOrderLineItemsPageResponse(input: {
  edges: Array<{ node: Record<string, unknown> }>;
  hasNextPage?: boolean;
  endCursor?: string | null;
}): Response {
  return Response.json({
    data: {
      order: {
        id: ORDER_GID_PAGINATED,
        lineItems: {
          edges: input.edges,
          pageInfo: {
            hasNextPage: input.hasNextPage ?? false,
            endCursor: input.endCursor ?? null,
          },
        },
      },
    },
  });
}

export function mockGraphqlErrorResponse(message: string): Response {
  return Response.json({
    errors: [{ message }],
  });
}

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

export function mockProductByIdResponse(input: {
  title?: string;
  status?: string;
  updatedAt?: string;
  inventoryQuantity?: number;
  tracked?: boolean;
  variants?: Array<{
    id: string;
    sku?: string;
    price?: string;
    inventoryQuantity?: number;
    inventoryItemId?: string;
    tracked?: boolean;
  }>;
}): Response {
  const variants = input.variants ?? [
    {
      id: VARIANT_GID,
      sku: "SKU-1",
      price: "19.99",
      inventoryQuantity: input.inventoryQuantity ?? 3,
      inventoryItemId: INVENTORY_ITEM_GID,
      tracked: input.tracked ?? true,
    },
  ];

  return Response.json({
    data: {
      product: {
        id: PRODUCT_GID,
        title: input.title ?? "Test Product",
        status: input.status ?? "ACTIVE",
        updatedAt: input.updatedAt ?? "2026-06-20T12:00:00Z",
        variants: {
          edges: variants.map((variant) => ({
            node: {
              id: variant.id,
              sku: variant.sku ?? "SKU-1",
              price: variant.price ?? "19.99",
              inventoryQuantity: variant.inventoryQuantity ?? 3,
              inventoryItem: {
                id: variant.inventoryItemId ?? INVENTORY_ITEM_GID,
                tracked: variant.tracked ?? true,
              },
            },
          })),
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    },
  });
}

export function mockProductsSyncGraphqlResponse(input: {
  inventoryQuantity: number;
  tracked?: boolean;
  updatedAt?: string;
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
              updatedAt: input.updatedAt ?? "2026-06-20T12:00:00Z",
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

export function seedUsageMetricForTests(
  storeId: string,
  metric: "products" | "orders" | "ai_requests" | "reports_generated",
  value: number,
  month?: string,
): void {
  const harness = testHarness();
  const usageMonth =
    month ??
    `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, "0")}`;
  const key = `${storeId}:${metric}:${usageMonth}`;

  harness.dbState.usageRecords.set(key, {
    id: crypto.randomUUID(),
    storeId,
    metric,
    month: usageMonth,
    value,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}
