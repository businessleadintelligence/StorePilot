import { vi } from "vitest";
import type { ProductStatus } from "@prisma/client";

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

const dbState = vi.hoisted(() => ({
  products: new Map<string, MockProduct>(),
  stores: [
    {
      id: "store-test-001",
      shopifyDomain: "storepilot-test.myshopify.com",
      active: true,
      lastProductsSyncAt: null as Date | null,
      lastInventorySyncAt: null as Date | null,
    },
  ],
  webhookEvents: new Map<string, MockWebhookEvent>(),
  webhookEventsById: new Map<string, MockWebhookEvent>(),
}));

const mockAdminGraphql = vi.hoisted(() => vi.fn());

const prismaMock = vi.hoisted(() => ({
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
    create: vi.fn(
      async ({
        data,
      }: {
        data: Omit<MockProduct, "id" | "createdAt" | "updatedAt"> & {
          storeId: string;
          shopifyVariantId: string;
        };
      }) => {
        const product: MockProduct = {
          id: crypto.randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        dbState.products.set(
          productKey(product.storeId, product.shopifyVariantId),
          product,
        );
        return product;
      },
    ),
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
          Object.keys(select).map((key) => [
            key,
            store[key as keyof typeof store],
          ]),
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
          Object.keys(select).map((key) => [
            key,
            event[key as keyof MockWebhookEvent],
          ]),
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
  $transaction: vi.fn(
    async (callback: (tx: typeof prismaMock) => Promise<unknown>) =>
      callback(prismaMock),
  ),
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

declare global {
  // eslint-disable-next-line no-var
  var __D7_TEST__: {
    dbState: typeof dbState;
    mockAdminGraphql: typeof mockAdminGraphql;
    resetDbState: () => void;
    seedProduct: (
      overrides: Partial<MockProduct> & Pick<MockProduct, "shopifyVariantId">,
    ) => MockProduct;
    getProduct: (shopifyVariantId: string) => MockProduct | undefined;
  };
}

globalThis.__D7_TEST__ = {
  dbState,
  mockAdminGraphql,
  resetDbState: () => {
    dbState.products.clear();
    dbState.webhookEvents.clear();
    dbState.webhookEventsById.clear();
    dbState.stores[0] = {
      id: "store-test-001",
      shopifyDomain: "storepilot-test.myshopify.com",
      active: true,
      lastProductsSyncAt: null,
      lastInventorySyncAt: null,
    };
  },
  seedProduct: (overrides) => {
    const product: MockProduct = {
      id: overrides.id ?? crypto.randomUUID(),
      storeId: overrides.storeId ?? "store-test-001",
      shopifyProductId:
        overrides.shopifyProductId ?? "gid://shopify/Product/789",
      shopifyVariantId: overrides.shopifyVariantId,
      shopifyInventoryItemId:
        overrides.shopifyInventoryItemId ?? "gid://shopify/InventoryItem/123",
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
  },
  getProduct: (shopifyVariantId) =>
    dbState.products.get(
      productKey("store-test-001", shopifyVariantId),
    ),
};
