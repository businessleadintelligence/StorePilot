import { vi } from "vitest";
import type { ProductStatus } from "@prisma/client";

export const STORE_ID = "store-test-001";
export const SHOP = "storepilot-test.myshopify.com";
export const PRODUCT_GID = "gid://shopify/Product/789";
export const VARIANT_GID = "gid://shopify/ProductVariant/456";
export const INVENTORY_ITEM_GID = "gid://shopify/InventoryItem/123";

export type MockProduct = {
  id: string;
  storeId: string;
  shopifyProductId: string;
  shopifyVariantId: string;
  shopifyInventoryItemId: string | null;
  title: string;
  sku: string | null;
  status: ProductStatus;
  price: unknown;
  inventoryQuantity: number | null;
  inventoryTracked: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type MockWebhookEvent = {
  id: string;
  storeId: string;
  shopifyWebhookId: string;
  shop: string;
  topic: string;
  processedSuccessfully: boolean;
  processedAt: Date;
  createdAt: Date;
};

type DbState = {
  products: Map<string, MockProduct>;
  stores: Array<{
    id: string;
    shopifyDomain: string;
    active: boolean;
    lastProductsSyncAt: Date | null;
    lastInventorySyncAt: Date | null;
  }>;
  webhookEvents: Map<string, MockWebhookEvent>;
  webhookEventsById: Map<string, MockWebhookEvent>;
};

function productKey(storeId: string, shopifyVariantId: string): string {
  return `${storeId}:${shopifyVariantId}`;
}

function matchesProductWhere(
  product: MockProduct,
  where: Record<string, unknown>,
): boolean {
  if (where.storeId && product.storeId !== where.storeId) {
    return false;
  }

  if (
    where.shopifyVariantId &&
    typeof where.shopifyVariantId === "object" &&
    where.shopifyVariantId !== null &&
    "notIn" in where.shopifyVariantId
  ) {
    const excluded = (where.shopifyVariantId as { notIn: string[] }).notIn;
    if (excluded.includes(product.shopifyVariantId)) {
      return false;
    }
  }

  if (
    where.shopifyProductId &&
    product.shopifyProductId !== where.shopifyProductId
  ) {
    return false;
  }

  if (
    where.shopifyInventoryItemId &&
    product.shopifyInventoryItemId !== where.shopifyInventoryItemId
  ) {
    return false;
  }

  if (where.inventoryTracked === true && !product.inventoryTracked) {
    return false;
  }

  if (where.inventoryTracked === false && product.inventoryTracked) {
    return false;
  }

  if (
    where.status &&
    typeof where.status === "object" &&
    where.status !== null &&
    "not" in where.status
  ) {
    const excludedStatus = (where.status as { not: ProductStatus }).not;
    if (product.status === excludedStatus) {
      return false;
    }
  }

  return true;
}

export const dbState = vi.hoisted((): DbState => ({
  products: new Map(),
  stores: [
    {
      id: STORE_ID,
      shopifyDomain: SHOP,
      active: true,
      lastProductsSyncAt: null,
      lastInventorySyncAt: null,
    },
  ],
  webhookEvents: new Map(),
  webhookEventsById: new Map(),
}));

export function resetDbState(): void {
  dbState.products.clear();
  dbState.webhookEvents.clear();
  dbState.webhookEventsById.clear();
  dbState.stores[0] = {
    id: STORE_ID,
    shopifyDomain: SHOP,
    active: true,
    lastProductsSyncAt: null,
    lastInventorySyncAt: null,
  };
}

export function seedProduct(
  overrides: Partial<MockProduct> & Pick<MockProduct, "shopifyVariantId">,
): MockProduct {
  const product: MockProduct = {
    id: overrides.id ?? crypto.randomUUID(),
    storeId: overrides.storeId ?? STORE_ID,
    shopifyProductId: overrides.shopifyProductId ?? PRODUCT_GID,
    shopifyVariantId: overrides.shopifyVariantId,
    shopifyInventoryItemId:
      overrides.shopifyInventoryItemId ?? INVENTORY_ITEM_GID,
    title: overrides.title ?? "Test Product",
    sku: overrides.sku ?? "SKU-1",
    status: overrides.status ?? "active",
    price: overrides.price ?? null,
    inventoryQuantity:
      overrides.inventoryQuantity === undefined
        ? 11
        : overrides.inventoryQuantity,
    inventoryTracked:
      overrides.inventoryTracked === undefined
        ? true
        : overrides.inventoryTracked,
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
  };

  dbState.products.set(
    productKey(product.storeId, product.shopifyVariantId),
    product,
  );
  return product;
}

export function getProduct(shopifyVariantId: string): MockProduct | undefined {
  return dbState.products.get(productKey(STORE_ID, shopifyVariantId));
}

export const mockAdminGraphql = vi.hoisted(() => vi.fn());

export const prismaMock = vi.hoisted(() => ({
  product: {
    findUnique: vi.fn(
      async ({
        where,
      }: {
        where: {
          storeId_shopifyVariantId?: {
            storeId: string;
            shopifyVariantId: string;
          };
        };
      }) => {
        const key = where.storeId_shopifyVariantId;
        if (!key) {
          return null;
        }

        return (
          dbState.products.get(
            productKey(key.storeId, key.shopifyVariantId),
          ) ?? null
        );
      },
    ),
    findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
      [...dbState.products.values()].filter((product) =>
        matchesProductWhere(product, where),
      ),
    ),
    create: vi.fn(async ({ data }: { data: Omit<MockProduct, "id" | "createdAt" | "updatedAt"> & { storeId: string } }) => {
      const product = seedProduct({
        ...data,
        shopifyVariantId: data.shopifyVariantId,
      });
      return product;
    }),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: {
          storeId_shopifyVariantId: {
            storeId: string;
            shopifyVariantId: string;
          };
        };
        data: Partial<MockProduct>;
      }) => {
        const existing = dbState.products.get(
          productKey(
            where.storeId_shopifyVariantId.storeId,
            where.storeId_shopifyVariantId.shopifyVariantId,
          ),
        );

        if (!existing) {
          throw new Error("Product not found");
        }

        const updated: MockProduct = {
          ...existing,
          ...data,
          updatedAt: new Date(),
        };

        dbState.products.set(
          productKey(updated.storeId, updated.shopifyVariantId),
          updated,
        );
        return updated;
      },
    ),
    updateMany: vi.fn(
      async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Partial<MockProduct>;
      }) => {
        let count = 0;

        for (const [key, product] of dbState.products.entries()) {
          if (!matchesProductWhere(product, where)) {
            continue;
          }

          dbState.products.set(key, {
            ...product,
            ...data,
            updatedAt: new Date(),
          });
          count += 1;
        }

        return { count };
      },
    ),
  },
  store: {
    findUnique: vi.fn(
      async ({
        where,
        select,
      }: {
        where: { id?: string; shopifyDomain?: string };
        select?: Record<string, boolean>;
      }) => {
        const store =
          dbState.stores.find((row) =>
            where.id
              ? row.id === where.id
              : row.shopifyDomain === where.shopifyDomain,
          ) ?? null;

        if (!store) {
          return null;
        }

        if (!select) {
          return store;
        }

        return Object.fromEntries(
          Object.keys(select).map((key) => [key, store[key as keyof typeof store]]),
        );
      },
    ),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<(typeof dbState.stores)[number]>;
      }) => {
        const store = dbState.stores.find((row) => row.id === where.id);
        if (!store) {
          throw new Error("Store not found");
        }

        Object.assign(store, data);
        return store;
      },
    ),
  },
  webhookEvent: {
    findUnique: vi.fn(
      async ({
        where,
        select,
      }: {
        where: { shopifyWebhookId?: string; id?: string };
        select?: Record<string, boolean>;
      }) => {
        const event = where.shopifyWebhookId
          ? dbState.webhookEvents.get(where.shopifyWebhookId)
          : where.id
            ? dbState.webhookEventsById.get(where.id)
            : undefined;

        if (!event) {
          return null;
        }

        if (!select) {
          return event;
        }

        return Object.fromEntries(
          Object.keys(select).map((key) => [key, event[key as keyof MockWebhookEvent]]),
        );
      },
    ),
    create: vi.fn(
      async ({
        data,
      }: {
        data: Omit<MockWebhookEvent, "id" | "processedAt" | "createdAt">;
      }) => {
        const event: MockWebhookEvent = {
          id: crypto.randomUUID(),
          processedAt: new Date(),
          createdAt: new Date(),
          ...data,
        };

        dbState.webhookEvents.set(event.shopifyWebhookId, event);
        dbState.webhookEventsById.set(event.id, event);
        return event;
      },
    ),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<MockWebhookEvent>;
      }) => {
        const event = dbState.webhookEventsById.get(where.id);
        if (!event) {
          throw new Error("Webhook event not found");
        }

        Object.assign(event, data);
        dbState.webhookEvents.set(event.shopifyWebhookId, event);
        return event;
      },
    ),
  },
}));

vi.mock("../../../db.server", () => ({
  default: prismaMock,
}));

vi.mock("../../../shopify.server", () => ({
  unauthenticated: {
    admin: vi.fn(async () => ({
      admin: {
        graphql: mockAdminGraphql,
      },
    })),
  },
}));

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
