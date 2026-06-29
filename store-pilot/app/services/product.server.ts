import { Prisma, type ProductStatus } from "@prisma/client";

import prisma from "../db.server";
import { unauthenticated } from "../shopify.server";
import {
  assertProductCreateAllowedAtomic,
  BILLING_LIMIT_EXCEEDED,
  checkProductCreateAllowed,
  runProductCreateWithAtomicLimit,
  toBillingLimitBlockedState,
} from "./billing-enforcement.server";
import type { StoreSyncAdminClient } from "./store.server";
import {
  classifyProductWebhookSkip,
  finalizeWebhookClaim,
  gateWebhookEvent,
  lookupStoreForWebhook,
  markWebhookEventProcessed,
} from "./webhook.server";

type ProductDbClient = Pick<typeof prisma, "product">;

const PRODUCTS_QUERY = `#graphql
  query StorePilotGetProducts($productCursor: String) {
    products(first: 250, after: $productCursor) {
      edges {
        node {
          id
          title
          status
          updatedAt
          variants(first: 250) {
            edges {
              node {
                id
                sku
                price
                inventoryQuantity
                inventoryItem {
                  id
                  tracked
                }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const PRODUCT_BY_ID_QUERY = `#graphql
  query StorePilotGetProductById($productId: ID!) {
    product(id: $productId) {
      id
      title
      status
      updatedAt
      variants(first: 250) {
        edges {
          node {
            id
            sku
            price
            inventoryQuantity
            inventoryItem {
              id
              tracked
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

const PRODUCT_VARIANTS_QUERY = `#graphql
  query StorePilotGetProductVariants($productId: ID!, $variantCursor: String) {
    product(id: $productId) {
      id
      title
      status
      updatedAt
      variants(first: 250, after: $variantCursor) {
        edges {
          node {
            id
            sku
            price
            inventoryQuantity
            inventoryItem {
              id
              tracked
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const RETRY_DELAYS_MS = [500, 1000, 2000] as const;
const MAX_ATTEMPTS = 3;

export type ProductSyncAdminClient = StoreSyncAdminClient;

export type SyncProductsInput = {
  storeId: string;
  shop: string;
  admin: ProductSyncAdminClient;
};

export type SyncProductsResult = {
  upserted: number;
  skipped: number;
  productsProcessed: number;
  variantsProcessed: number;
  productPages: number;
  success: boolean;
  blocked?: boolean;
  blockedReason?: string;
  blockedMessage?: string;
};

export type UpsertVariantRowResult = {
  action: "created" | "updated" | "limit_exceeded" | "stale_skipped";
};

type LogLevel = "info" | "warn" | "error";

type ProductSyncLogContext = {
  shop: string;
  storeId?: string;
  operation:
    | "bootstrap_scheduled"
    | "sync_started"
    | "product_page"
    | "variant_page"
    | "variant_pages_loaded"
    | "sync_completed"
    | "sync_summary"
    | "sync_failed"
    | "graphql_error"
    | "store_ineligible"
    | "zero_variants"
    | "limit_exceeded"
    | "sync_reconcile"
    | "sync_reconcile_skipped"
    | "product_variants_archived"
    | "stale_write_skipped";
  reason?: string;
  shopifyVariantId?: string;
  upserted?: number;
  skipped?: number;
  productsProcessed?: number;
  variantsProcessed?: number;
  productPage?: number;
  productId?: string;
  variantCount?: number;
  variantPages?: number;
  normalizedVariantCount?: number;
  shopifyVariantCount?: number;
  archived?: number;
  durationMs?: number;
};

interface GraphQlError {
  message?: string;
  extensions?: {
    code?: string;
  };
}

interface ProductVariantNode {
  id?: string | null;
  sku?: string | null;
  price?: string | null;
  inventoryQuantity?: number | null;
  inventoryItem?: {
    id?: string | null;
    tracked?: boolean | null;
  } | null;
}

interface VariantConnectionPageInfo {
  hasNextPage?: boolean | null;
  endCursor?: string | null;
}

interface ProductNode {
  id?: string | null;
  title?: string | null;
  status?: string | null;
  updatedAt?: string | null;
  variants?: {
    edges?: Array<{ node?: ProductVariantNode | null }> | null;
    pageInfo?: VariantConnectionPageInfo | null;
  } | null;
}

interface ProductsQueryResponse {
  data?: {
    products?: {
      edges?: Array<{ node?: ProductNode | null }> | null;
      pageInfo?: {
        hasNextPage?: boolean | null;
        endCursor?: string | null;
      } | null;
    } | null;
  };
  errors?: GraphQlError[];
}

interface ProductVariantsQueryResponse {
  data?: {
    product?: ProductNode | null;
  };
  errors?: GraphQlError[];
}

interface ProductByIdQueryResponse {
  data?: {
    product?: ProductNode | null;
  };
  errors?: GraphQlError[];
}

export type FetchProductByIdResult = {
  product: ProductNode;
  variants: ProductVariantNode[];
};

export type FetchAllVariantsResult = {
  variants: ProductVariantNode[];
  variantPages: number;
};

interface NormalizedVariantRow {
  shopifyProductId: string;
  shopifyVariantId: string;
  shopifyInventoryItemId: string | null;
  title: string;
  sku: string | null;
  status: ProductStatus;
  price: Prisma.Decimal | null;
  inventoryQuantity: number | null;
  /** Set only by GraphQL sync normalization (`normalizeVariantRow`). */
  inventoryTracked?: boolean;
  shopifyProductUpdatedAt: Date | null;
}

export type UpsertVariantSource = "sync" | "webhook";

export interface ShopifyProductWebhookVariant {
  admin_graphql_api_id?: string | null;
  id?: number | string | null;
  sku?: string | null;
  price?: string | null;
  inventory_quantity?: number | null;
  inventory_management?: string | null;
  inventory_item_id?: number | string | null;
}

export interface ShopifyProductWebhookPayload {
  admin_graphql_api_id?: string | null;
  id?: number | string | null;
  title?: string | null;
  status?: string | null;
  updated_at?: string | null;
  variants?: ShopifyProductWebhookVariant[] | null;
}

export type ProductWebhookInput = {
  shop: string;
  topic: string;
  payload: Record<string, unknown>;
  webhookId: string;
};

export type ProductWebhookResult = {
  success: boolean;
  upserted: number;
  archived: number;
  skipped: number;
  shopifyProductId?: string;
  retryable?: boolean;
  reason?: string;
  skipReason?: string;
};

type ProductWebhookLogContext = {
  shop: string;
  storeId?: string;
  topic?: string;
  webhookId?: string;
  operation:
    | "webhook_received"
    | "webhook_upsert"
    | "webhook_reconcile"
    | "webhook_reconcile_skipped"
    | "webhook_archive"
    | "webhook_completed"
    | "webhook_summary"
    | "webhook_failed"
    | "webhook_skipped"
    | "store_ineligible"
    | "zero_variants"
    | "limit_exceeded"
    | "product_variants_archived"
    | "product_not_found"
    | "graphql_fetch_failed";
  reason?: string;
  shopifyProductId?: string;
  productId?: string;
  skippedVariants?: number;
  payloadVariantCount?: number;
  upserted?: number;
  archived?: number;
  skipped?: number;
  durationMs?: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function logProductSync(
  level: LogLevel,
  message: string,
  context: ProductSyncLogContext,
): void {
  const payload = { message, ...context };

  if (level === "error") {
    console.error("[product-sync]", payload);
    return;
  }

  if (level === "warn") {
    console.warn("[product-sync]", payload);
    return;
  }

  console.info("[product-sync]", payload);
}

export function mapProductStatus(
  shopifyStatus: string | null | undefined,
): ProductStatus {
  switch (shopifyStatus?.toUpperCase()) {
    case "ACTIVE":
      return "active";
    case "ARCHIVED":
      return "archived";
    case "DRAFT":
      return "draft";
    default:
      return "active";
  }
}

export async function graphqlWithRetry(
  admin: ProductSyncAdminClient,
  query: string,
  variables: Record<string, unknown>,
  context: { shop: string; storeId?: string },
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const response = await admin.graphql(query, { variables });

      if (RETRYABLE_STATUS_CODES.has(response.status)) {
        lastError = new Error(`HTTP ${response.status}`);
        if (attempt < MAX_ATTEMPTS - 1) {
          await sleep(RETRY_DELAYS_MS[attempt] ?? 2000);
          continue;
        }
        throw lastError;
      }

      return response;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS - 1) {
        await sleep(RETRY_DELAYS_MS[attempt] ?? 2000);
        continue;
      }
      logProductSync("error", "GraphQL request failed after retries", {
        shop: context.shop,
        storeId: context.storeId,
        operation: "graphql_error",
        reason: error instanceof Error ? error.message : "unknown_error",
      });
      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("GraphQL request failed");
}

function parseIsoDateTime(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export function normalizeVariantRow(
  product: ProductNode,
  variant: ProductVariantNode,
): NormalizedVariantRow | null {
  if (!product.id || !product.title || !variant.id) {
    return null;
  }

  return {
    shopifyProductId: product.id,
    shopifyVariantId: variant.id,
    shopifyInventoryItemId: variant.inventoryItem?.id ?? null,
    title: product.title,
    sku: variant.sku?.trim() ? variant.sku : null,
    status: mapProductStatus(product.status),
    price: variant.price ? new Prisma.Decimal(variant.price) : null,
    inventoryQuantity: variant.inventoryQuantity ?? null,
    inventoryTracked: variant.inventoryItem?.tracked ?? true,
    shopifyProductUpdatedAt: parseIsoDateTime(product.updatedAt),
  };
}

export async function upsertVariantRow(
  storeId: string,
  row: NormalizedVariantRow,
  source: UpsertVariantSource = "sync",
  db: ProductDbClient = prisma,
): Promise<UpsertVariantRowResult> {
  if (process.env.PRODUCT_SYNC_SIMULATE_PRISMA_FAILURE === "1") {
    throw new Error(
      "Simulated Prisma failure (PRODUCT_SYNC_SIMULATE_PRISMA_FAILURE)",
    );
  }

  const existing = await db.product.findUnique({
    where: {
      storeId_shopifyVariantId: {
        storeId,
        shopifyVariantId: row.shopifyVariantId,
      },
    },
    select: { inventoryTracked: true, shopifyProductUpdatedAt: true },
  });

  const catalogUpdate = {
    shopifyProductId: row.shopifyProductId,
    title: row.title,
    sku: row.sku,
    status: row.status,
    price: row.price,
    ...(row.shopifyInventoryItemId != null && {
      shopifyInventoryItemId: row.shopifyInventoryItemId,
    }),
    ...(row.shopifyProductUpdatedAt != null && {
      shopifyProductUpdatedAt: row.shopifyProductUpdatedAt,
    }),
  };

  if (existing) {
    if (
      row.shopifyProductUpdatedAt &&
      existing.shopifyProductUpdatedAt &&
      row.shopifyProductUpdatedAt <= existing.shopifyProductUpdatedAt
    ) {
      logProductSync("info", "Product update skipped due to stale Shopify timestamp", {
        shop: "",
        storeId,
        operation: "stale_write_skipped",
        shopifyVariantId: row.shopifyVariantId,
      });

      return { action: "stale_skipped" };
    }

    const updateData: Prisma.ProductUpdateInput = { ...catalogUpdate };

    if (source === "sync") {
      const inventoryTracked = row.inventoryTracked ?? true;
      updateData.inventoryTracked = inventoryTracked;
      if (!inventoryTracked) {
        updateData.inventoryQuantity = row.inventoryQuantity;
      }
    } else if (!existing.inventoryTracked) {
      updateData.inventoryQuantity = row.inventoryQuantity;
    }

    if (row.shopifyProductUpdatedAt) {
      const updated = await db.product.updateMany({
        where: {
          storeId,
          shopifyVariantId: row.shopifyVariantId,
          OR: [
            { shopifyProductUpdatedAt: null },
            { shopifyProductUpdatedAt: { lt: row.shopifyProductUpdatedAt } },
          ],
        },
        data: updateData as Prisma.ProductUpdateManyMutationInput,
      });

      if (updated.count === 0) {
        logProductSync("info", "Product update skipped due to stale Shopify timestamp", {
          shop: "",
          storeId,
          operation: "stale_write_skipped",
          shopifyVariantId: row.shopifyVariantId,
        });
        return { action: "stale_skipped" };
      }

      return { action: "updated" };
    }

    await db.product.update({
      where: {
        storeId_shopifyVariantId: {
          storeId,
          shopifyVariantId: row.shopifyVariantId,
        },
      },
      data: updateData,
    });
    return { action: "updated" };
  }

  let inventoryTracked: boolean;
  let inventoryQuantity: number | null;

  if (source === "sync") {
    inventoryTracked = row.inventoryTracked ?? true;
    inventoryQuantity = row.inventoryQuantity;
  } else {
    inventoryTracked = row.shopifyInventoryItemId != null;
    inventoryQuantity = inventoryTracked ? null : row.inventoryQuantity;
  }

  const createData = {
    storeId,
    shopifyProductId: row.shopifyProductId,
    shopifyVariantId: row.shopifyVariantId,
    shopifyInventoryItemId: row.shopifyInventoryItemId,
    title: row.title,
    sku: row.sku,
    status: row.status,
    price: row.price,
    inventoryQuantity,
    inventoryTracked,
    ...(row.shopifyProductUpdatedAt != null && {
      shopifyProductUpdatedAt: row.shopifyProductUpdatedAt,
    }),
  };

  try {
    return await runProductCreateWithAtomicLimit(db, async (client) => {
      const limitCheck = await assertProductCreateAllowedAtomic(client, storeId);
      if (!limitCheck.allowed) {
        return { action: "limit_exceeded" as const };
      }

      await client.product.create({ data: createData });
      return { action: "created" as const };
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const raced = await db.product.findUnique({
        where: {
          storeId_shopifyVariantId: {
            storeId,
            shopifyVariantId: row.shopifyVariantId,
          },
        },
        select: { id: true },
      });

      if (raced) {
        return upsertVariantRow(storeId, row, source, db);
      }
    }

    throw error;
  }
}

export async function fetchProductPage(
  admin: ProductSyncAdminClient,
  shop: string,
  storeId: string,
  productCursor: string | null,
): Promise<ProductsQueryResponse> {
  if (process.env.PRODUCT_SYNC_SIMULATE_GRAPHQL_FAILURE === "1") {
    throw new Error(
      "Simulated GraphQL failure (PRODUCT_SYNC_SIMULATE_GRAPHQL_FAILURE)",
    );
  }

  const response = await graphqlWithRetry(
    admin,
    PRODUCTS_QUERY,
    { productCursor },
    { shop, storeId },
  );
  const body = (await response.json()) as ProductsQueryResponse;

  handleProductSyncGraphqlErrors(body, shop, storeId);

  return body;
}

function collectVariantNodes(
  edges: Array<{ node?: ProductVariantNode | null }> | null | undefined,
): ProductVariantNode[] {
  const variants: ProductVariantNode[] = [];

  for (const edge of edges ?? []) {
    if (edge?.node) {
      variants.push(edge.node);
    }
  }

  return variants;
}

function handleProductSyncGraphqlErrors(
  body: { errors?: GraphQlError[] },
  shop: string,
  storeId: string,
): void {
  if (!body.errors?.length) {
    return;
  }

  const reason = body.errors
    .map((error) => error.message ?? "unknown")
    .join("; ");

  logProductSync("error", "GraphQL returned errors", {
    shop,
    storeId,
    operation: "graphql_error",
    reason,
  });

  const insufficientScope = body.errors.some(
    (error) =>
      error.extensions?.code === "ACCESS_DENIED" ||
      reason.toLowerCase().includes("access denied"),
  );

  throw new Error(insufficientScope ? "insufficient_scope" : "graphql_errors");
}

export async function fetchProductVariantPage(
  admin: ProductSyncAdminClient,
  shop: string,
  storeId: string,
  productId: string,
  variantCursor: string | null,
): Promise<ProductVariantsQueryResponse> {
  if (process.env.PRODUCT_SYNC_SIMULATE_GRAPHQL_FAILURE === "1") {
    throw new Error(
      "Simulated GraphQL failure (PRODUCT_SYNC_SIMULATE_GRAPHQL_FAILURE)",
    );
  }

  const response = await graphqlWithRetry(
    admin,
    PRODUCT_VARIANTS_QUERY,
    { productId, variantCursor },
    { shop, storeId },
  );
  const body = (await response.json()) as ProductVariantsQueryResponse;

  handleProductSyncGraphqlErrors(body, shop, storeId);

  return body;
}

export async function fetchAllVariantsForProduct(
  admin: ProductSyncAdminClient,
  shop: string,
  storeId: string,
  product: ProductNode,
): Promise<FetchAllVariantsResult> {
  if (!product.id) {
    throw new Error("missing_product_id");
  }

  const variants = collectVariantNodes(product.variants?.edges);
  let variantPages = 1;
  let hasNextPage = product.variants?.pageInfo?.hasNextPage === true;
  let variantCursor = product.variants?.pageInfo?.endCursor ?? null;

  while (hasNextPage) {
    if (!variantCursor) {
      throw new Error("missing_variant_page_cursor");
    }

    variantPages += 1;

    const body = await fetchProductVariantPage(
      admin,
      shop,
      storeId,
      product.id,
      variantCursor,
    );
    const productNode = body.data?.product;

    if (!productNode?.id) {
      throw new Error("product_not_found_in_graphql");
    }

    variants.push(...collectVariantNodes(productNode.variants?.edges));

    hasNextPage = productNode.variants?.pageInfo?.hasNextPage === true;
    variantCursor = productNode.variants?.pageInfo?.endCursor ?? null;

    logProductSync("info", "Fetched variant page", {
      shop,
      storeId,
      operation: "variant_page",
      reason: product.id,
      productPage: variantPages,
      variantsProcessed: variants.length,
    });
  }

  return { variants, variantPages };
}

export async function fetchProductById(
  admin: ProductSyncAdminClient,
  shop: string,
  storeId: string,
  productGid: string,
): Promise<FetchProductByIdResult | null> {
  if (process.env.PRODUCT_SYNC_SIMULATE_GRAPHQL_FAILURE === "1") {
    throw new Error(
      "Simulated GraphQL failure (PRODUCT_SYNC_SIMULATE_GRAPHQL_FAILURE)",
    );
  }

  const response = await graphqlWithRetry(
    admin,
    PRODUCT_BY_ID_QUERY,
    { productId: productGid },
    { shop, storeId },
  );
  const body = (await response.json()) as ProductByIdQueryResponse;

  handleProductSyncGraphqlErrors(body, shop, storeId);

  const product = body.data?.product;
  if (!product?.id) {
    return null;
  }

  const { variants, variantPages } = await fetchAllVariantsForProduct(
    admin,
    shop,
    storeId,
    product,
  );

  if (variantPages > 1) {
    logProductSync("info", "Loaded paginated product variants for webhook fetch", {
      shop,
      storeId,
      operation: "variant_pages_loaded",
      productId: product.id,
      variantCount: variants.length,
      variantPages,
    });
  }

  return { product, variants };
}

async function assertStoreEligible(
  storeId: string,
  shop: string,
): Promise<boolean> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { id: true, active: true, shopifyDomain: true },
  });

  if (!store || !store.active || store.shopifyDomain !== shop) {
    logProductSync("error", "Store is not eligible for product sync", {
      shop,
      storeId,
      operation: "store_ineligible",
      reason: !store
        ? "store_not_found"
        : !store.active
          ? "store_inactive"
          : "shop_domain_mismatch",
    });
    return false;
  }

  return true;
}

export async function syncProductsFromShopify(
  input: SyncProductsInput,
): Promise<SyncProductsResult> {
  const { storeId, shop, admin } = input;
  const startedAt = Date.now();

  const result: SyncProductsResult = {
    upserted: 0,
    skipped: 0,
    productsProcessed: 0,
    variantsProcessed: 0,
    productPages: 0,
    success: false,
  };

  if (!(await assertStoreEligible(storeId, shop))) {
    logProductSync("error", "Product sync failed", {
      shop,
      storeId,
      operation: "sync_failed",
      reason: "store_ineligible",
    });
    return result;
  }

  logProductSync("info", "Product sync started", {
    shop,
    storeId,
    operation: "sync_started",
  });

  try {
    let productCursor: string | null = null;
    let hasNextPage = true;
    let billingLimitReached = false;

    while (hasNextPage && !billingLimitReached) {
      result.productPages += 1;

      const body = await fetchProductPage(
        admin,
        shop,
        storeId,
        productCursor,
      );
      const products = body.data?.products;
      const edges = products?.edges ?? [];

      logProductSync("info", "Fetched product page", {
        shop,
        storeId,
        operation: "product_page",
        productPage: result.productPages,
        productsProcessed: edges.length,
      });

      for (const edge of edges) {
        const product = edge.node;
        if (!product?.id || !product.title) {
          result.skipped += 1;
          continue;
        }

        result.productsProcessed += 1;

        const { variants, variantPages } = await fetchAllVariantsForProduct(
          admin,
          shop,
          storeId,
          product,
        );

        const shopifyVariantCount = variants.length;
        const activeVariantIds: string[] = [];
        let normalizedVariantCount = 0;

        if (shopifyVariantCount === 0) {
          const archived = await reconcileRemovedVariants(
            storeId,
            product.id,
            activeVariantIds,
          );

          if (archived > 0) {
            logProductSync("info", "Archived variants for zero-variant product", {
              shop,
              storeId,
              operation: "product_variants_archived",
              productId: product.id,
              archived,
            });
          } else {
            logProductSync("warn", "Product has zero variants", {
              shop,
              storeId,
              operation: "zero_variants",
              reason: product.id,
            });
          }

          continue;
        }

        if (variantPages > 1) {
          logProductSync("info", "Loaded paginated product variants", {
            shop,
            storeId,
            operation: "variant_pages_loaded",
            productId: product.id,
            variantCount: variants.length,
            variantPages,
          });
        }

        for (const variant of variants) {
          if (!variant) {
            result.skipped += 1;
            continue;
          }

          result.variantsProcessed += 1;

          const row = normalizeVariantRow(product, variant);
          if (!row) {
            result.skipped += 1;
            continue;
          }

          const upsertResult = await upsertVariantRow(storeId, row, "sync");

          if (upsertResult.action === "limit_exceeded") {
            result.skipped += 1;
            const limitCheck = await checkProductCreateAllowed(storeId);
            const blockedState = toBillingLimitBlockedState("products", limitCheck);
            result.blocked = blockedState.blocked;
            result.blockedReason = blockedState.blockedReason;
            result.blockedMessage = blockedState.blockedMessage;

            logProductSync("warn", "Product sync blocked by plan limit", {
              shop,
              storeId,
              operation: "limit_exceeded",
              reason: BILLING_LIMIT_EXCEEDED,
              skipped: result.skipped,
              upserted: result.upserted,
            });

            billingLimitReached = true;
            break;
          }

          activeVariantIds.push(row.shopifyVariantId);
          normalizedVariantCount += 1;

          if (upsertResult.action === "stale_skipped") {
            continue;
          }

          result.upserted += 1;
        }

        if (billingLimitReached) {
          break;
        }

        if (normalizedVariantCount === shopifyVariantCount) {
          const archived = await reconcileRemovedVariants(
            storeId,
            product.id,
            activeVariantIds,
          );

          if (archived > 0) {
            logProductSync("info", "Removed product variants archived during sync", {
              shop,
              storeId,
              operation: "sync_reconcile",
              productId: product.id,
              archived,
            });
          }
        } else {
          logProductSync("warn", "Product sync reconcile skipped", {
            shop,
            storeId,
            operation: "sync_reconcile_skipped",
            productId: product.id,
            normalizedVariantCount,
            shopifyVariantCount,
          });
        }

        if (billingLimitReached) {
          break;
        }
      }

      if (billingLimitReached) {
        break;
      }

      hasNextPage = products?.pageInfo?.hasNextPage === true;
      productCursor = products?.pageInfo?.endCursor ?? null;

      if (hasNextPage && !productCursor) {
        throw new Error("missing_product_page_cursor");
      }
    }

    if (!result.blocked) {
      await prisma.store.update({
        where: { id: storeId },
        data: { lastProductsSyncAt: new Date() },
      });
    }

    result.success = !result.blocked && result.skipped === 0;

    const durationMs = Date.now() - startedAt;

    logProductSync("info", "Product sync completed", {
      shop,
      storeId,
      operation: "sync_completed",
      upserted: result.upserted,
      skipped: result.skipped,
      productsProcessed: result.productsProcessed,
      variantsProcessed: result.variantsProcessed,
      productPage: result.productPages,
      durationMs,
    });

    logProductSync("info", "Product sync summary", {
      shop,
      storeId,
      operation: "sync_summary",
      productsProcessed: result.productsProcessed,
      variantsProcessed: result.variantsProcessed,
      upserted: result.upserted,
      skipped: result.skipped,
      durationMs,
    });

    return result;
  } catch (error) {
    logProductSync("error", "Product sync failed", {
      shop,
      storeId,
      operation: "sync_failed",
      reason: error instanceof Error ? error.message : "unknown_error",
      upserted: result.upserted,
      skipped: result.skipped,
      productsProcessed: result.productsProcessed,
      variantsProcessed: result.variantsProcessed,
      durationMs: Date.now() - startedAt,
    });
    return result;
  }
}

export function scheduleBootstrapProductSync(input: {
  shop: string;
  admin: ProductSyncAdminClient;
}): void {
  const shop = input.shop;

  logProductSync("info", "Bootstrap product sync scheduled", {
    shop,
    operation: "bootstrap_scheduled",
  });

  void (async () => {
    const store = await prisma.store.findUnique({
      where: { shopifyDomain: shop },
      select: { id: true, active: true },
    });

    if (!store?.active) {
      logProductSync("error", "Store is not eligible for bootstrap sync", {
        shop,
        operation: "store_ineligible",
        reason: !store ? "store_not_found" : "store_inactive",
      });
      return;
    }

    await syncProductsFromShopify({
      storeId: store.id,
      shop,
      admin: input.admin,
    });
  })().catch((error) => {
    logProductSync("error", "Bootstrap product sync failed", {
      shop,
      operation: "sync_failed",
      reason: error instanceof Error ? error.message : "unknown_error",
    });
  });
}

export function logProductWebhook(
  level: LogLevel,
  message: string,
  context: ProductWebhookLogContext,
): void {
  const payload = { message, ...context };

  if (level === "error") {
    console.error("[product-webhook]", payload);
    return;
  }

  if (level === "warn") {
    console.warn("[product-webhook]", payload);
    return;
  }

  console.info("[product-webhook]", payload);
}

function toShopifyGid(
  resource: "Product" | "ProductVariant" | "InventoryItem",
  id: string | number,
): string {
  const value = String(id);
  if (value.startsWith("gid://")) {
    return value;
  }

  return `gid://shopify/${resource}/${value}`;
}

export function parseProductWebhookPayload(
  payload: Record<string, unknown>,
): ShopifyProductWebhookPayload | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  return payload as ShopifyProductWebhookPayload;
}

function resolveShopifyProductId(
  payload: ShopifyProductWebhookPayload,
): string | null {
  if (payload.admin_graphql_api_id) {
    return payload.admin_graphql_api_id;
  }

  if (payload.id !== undefined && payload.id !== null) {
    return toShopifyGid("Product", payload.id);
  }

  return null;
}

function resolveShopifyVariantId(variant: ShopifyProductWebhookVariant): string | null {
  if (variant.admin_graphql_api_id) {
    return variant.admin_graphql_api_id;
  }

  if (variant.id !== undefined && variant.id !== null) {
    return toShopifyGid("ProductVariant", variant.id);
  }

  return null;
}

export function normalizeWebhookVariantRow(
  payload: ShopifyProductWebhookPayload,
  variant: ShopifyProductWebhookVariant,
): NormalizedVariantRow | null {
  const shopifyProductId = resolveShopifyProductId(payload);
  const shopifyVariantId = resolveShopifyVariantId(variant);

  if (!shopifyProductId || !payload.title || !shopifyVariantId) {
    return null;
  }

  const sku = variant.sku?.trim() ? variant.sku : null;
  const shopifyInventoryItemId =
    variant.inventory_item_id !== undefined && variant.inventory_item_id !== null
      ? toShopifyGid("InventoryItem", variant.inventory_item_id)
      : null;

  return {
    shopifyProductId,
    shopifyVariantId,
    shopifyInventoryItemId,
    title: payload.title,
    sku,
    status: mapProductStatus(payload.status),
    price: variant.price ? new Prisma.Decimal(variant.price) : null,
    inventoryQuantity: variant.inventory_quantity ?? null,
    shopifyProductUpdatedAt: parseIsoDateTime(payload.updated_at),
  };
}

export async function resolveStoreForWebhook(
  shop: string,
): Promise<{ storeId: string } | null> {
  const lookup = await lookupStoreForWebhook(shop);

  if (!lookup?.active) {
    logProductWebhook("error", "Store is not eligible for product webhook", {
      shop,
      operation: "store_ineligible",
      reason: !lookup ? "store_not_found" : "store_inactive",
    });
    return null;
  }

  return { storeId: lookup.storeId };
}

async function beginProductWebhook(
  input: ProductWebhookInput,
): Promise<
  | { kind: "retryable"; reason: "store_not_found" }
  | { kind: "duplicate" }
  | { kind: "lease_retry"; storeId: string; reason: string }
  | { kind: "inactive"; storeId: string; eventId?: string }
  | { kind: "ready"; storeId: string; eventId?: string; processingOwner: string }
> {
  const lookup = await lookupStoreForWebhook(input.shop);

  if (!lookup) {
    logProductWebhook("warn", "Store not found for product webhook", {
      shop: input.shop,
      topic: input.topic,
      webhookId: input.webhookId,
      operation: "store_ineligible",
      reason: "store_not_found",
    });

    return { kind: "retryable", reason: "store_not_found" };
  }

  const gate = await gateWebhookEvent({
    shop: input.shop,
    topic: input.topic,
    webhookId: input.webhookId,
    lookup,
  });

  if (gate.outcome === "duplicate") {
    logProductWebhook("info", "Duplicate product webhook skipped", {
      shop: input.shop,
      storeId: lookup.storeId,
      topic: input.topic,
      webhookId: input.webhookId,
      operation: "webhook_skipped",
      reason: "duplicate_webhook",
    });

    return { kind: "duplicate" };
  }

  if (gate.outcome === "lease_retry") {
    logProductWebhook("info", "Product webhook deferred for lease contention", {
      shop: input.shop,
      storeId: gate.storeId,
      topic: input.topic,
      webhookId: input.webhookId,
      operation: "webhook_skipped",
      reason: gate.reason,
    });

    return { kind: "lease_retry", storeId: gate.storeId, reason: gate.reason };
  }

  if (gate.outcome === "inactive_retry") {
    logProductWebhook("info", "Product webhook deferred for inactive store", {
      shop: input.shop,
      storeId: gate.storeId,
      topic: input.topic,
      webhookId: input.webhookId,
      operation: "webhook_skipped",
      reason: "store_inactive",
    });

    return { kind: "inactive", storeId: gate.storeId };
  }

  if (gate.outcome !== "ready") {
    return { kind: "lease_retry", storeId: lookup.storeId, reason: "webhook_gate_not_ready" };
  }

  return {
    kind: "ready",
    storeId: gate.storeId,
    eventId: gate.eventId,
    processingOwner: gate.processingOwner,
  };
}

function productWebhookSkippedResult(): ProductWebhookResult {
  return {
    success: true,
    upserted: 0,
    archived: 0,
    skipped: 1,
  };
}

function productWebhookInactiveResult(): ProductWebhookResult {
  return {
    success: false,
    upserted: 0,
    archived: 0,
    skipped: 0,
    retryable: true,
    reason: "store_inactive",
  };
}

function productWebhookLeaseRetryResult(reason: string): ProductWebhookResult {
  return {
    success: false,
    upserted: 0,
    archived: 0,
    skipped: 0,
    retryable: true,
    reason,
  };
}

export async function archiveProductByShopifyId(
  storeId: string,
  shopifyProductId: string,
  db: ProductDbClient = prisma,
): Promise<number> {
  const result = await db.product.updateMany({
    where: {
      storeId,
      shopifyProductId,
      status: { not: "archived" },
    },
    data: { status: "archived" },
  });

  return result.count;
}

export async function reconcileRemovedVariants(
  storeId: string,
  shopifyProductId: string,
  activeVariantIds: string[],
  db: ProductDbClient = prisma,
): Promise<number> {
  const result = await db.product.updateMany({
    where: {
      storeId,
      shopifyProductId,
      shopifyVariantId: { notIn: activeVariantIds },
      status: { not: "archived" },
    },
    data: { status: "archived" },
  });

  return result.count;
}

async function applyProductGraphqlWrites(
  input: ProductWebhookInput,
  storeId: string,
  product: ProductNode,
  variants: ProductVariantNode[],
  db: ProductDbClient,
): Promise<Pick<ProductWebhookResult, "upserted" | "archived" | "skipped">> {
  const shopifyProductId = product.id;
  if (!shopifyProductId) {
    throw new Error("missing_product_id");
  }

  const shopifyVariantCount = variants.length;

  if (shopifyVariantCount === 0) {
    const archived = await archiveProductByShopifyId(
      storeId,
      shopifyProductId,
      db,
    );

    logProductWebhook("info", "Archived variants for zero-variant product", {
      shop: input.shop,
      storeId,
      topic: input.topic,
      webhookId: input.webhookId,
      operation: "product_variants_archived",
      shopifyProductId,
      archived,
    });

    return { upserted: 0, archived, skipped: 0 };
  }

  const activeVariantIds: string[] = [];
  let upserted = 0;
  let skipped = 0;
  let normalizedVariantCount = 0;

  for (const variant of variants) {
    if (!variant) {
      skipped += 1;
      continue;
    }

    const row = normalizeVariantRow(product, variant);
    if (!row) {
      skipped += 1;
      continue;
    }

    normalizedVariantCount += 1;
    activeVariantIds.push(row.shopifyVariantId);

    const upsertResult = await upsertVariantRow(storeId, row, "webhook", db);

    if (upsertResult.action === "limit_exceeded") {
      skipped += 1;
      logProductWebhook("warn", "Product webhook create blocked by plan limit", {
        shop: input.shop,
        storeId,
        topic: input.topic,
        webhookId: input.webhookId,
        operation: "limit_exceeded",
        reason: BILLING_LIMIT_EXCEEDED,
        shopifyProductId,
      });
      continue;
    }

    if (upsertResult.action === "stale_skipped") {
      continue;
    }

    upserted += 1;
  }

  logProductWebhook("info", "Product webhook variants upserted from GraphQL", {
    shop: input.shop,
    storeId,
    topic: input.topic,
    webhookId: input.webhookId,
    operation: "webhook_upsert",
    shopifyProductId,
    upserted,
    skipped,
  });

  let archived = 0;

  if (normalizedVariantCount === shopifyVariantCount) {
    archived = await reconcileRemovedVariants(
      storeId,
      shopifyProductId,
      activeVariantIds,
      db,
    );

    if (archived > 0) {
      logProductWebhook("info", "Removed product variants archived", {
        shop: input.shop,
        storeId,
        topic: input.topic,
        webhookId: input.webhookId,
        operation: "webhook_reconcile",
        shopifyProductId,
        archived,
      });
    }
  } else {
    logProductWebhook("warn", "Product webhook reconcile skipped", {
      shop: input.shop,
      storeId,
      topic: input.topic,
      webhookId: input.webhookId,
      operation: "webhook_reconcile_skipped",
      productId: shopifyProductId,
      skippedVariants: shopifyVariantCount - normalizedVariantCount,
      payloadVariantCount: shopifyVariantCount,
    });
  }

  if (mapProductStatus(product.status) === "archived") {
    archived += await archiveProductByShopifyId(storeId, shopifyProductId, db);
  }

  return { upserted, archived, skipped };
}

async function upsertProductFromWebhookGraphql(
  input: ProductWebhookInput,
  storeId: string,
): Promise<ProductWebhookResult> {
  const startedAt = Date.now();
  const result: ProductWebhookResult = {
    success: false,
    upserted: 0,
    archived: 0,
    skipped: 0,
  };

  const payload = parseProductWebhookPayload(input.payload);
  if (!payload) {
    logProductWebhook("warn", "Invalid product webhook payload", {
      shop: input.shop,
      storeId,
      topic: input.topic,
      webhookId: input.webhookId,
      operation: "webhook_skipped",
      reason: "invalid_payload",
    });
    result.success = true;
    result.skipped += 1;
    return result;
  }

  const shopifyProductId = resolveShopifyProductId(payload);
  if (!shopifyProductId) {
    logProductWebhook("warn", "Product webhook missing required fields", {
      shop: input.shop,
      storeId,
      topic: input.topic,
      webhookId: input.webhookId,
      operation: "webhook_skipped",
      reason: "missing_product_fields",
    });
    result.success = true;
    result.skipped += 1;
    return result;
  }

  result.shopifyProductId = shopifyProductId;

  const { admin } = await unauthenticated.admin(input.shop);
  const fetched = await fetchProductById(
    admin,
    input.shop,
    storeId,
    shopifyProductId,
  );

  if (!fetched) {
    logProductWebhook("warn", "Product webhook product not found in GraphQL", {
      shop: input.shop,
      storeId,
      topic: input.topic,
      webhookId: input.webhookId,
      operation: "product_not_found",
      reason: "product_not_found",
      shopifyProductId,
    });

    return {
      ...result,
      success: true,
      skipped: 1,
      skipReason: "product_not_found",
    };
  }

  const writes = await prisma.$transaction(async (tx) =>
    applyProductGraphqlWrites(
      input,
      storeId,
      fetched.product,
      fetched.variants,
      tx,
    ),
  );

  result.upserted = writes.upserted;
  result.archived = writes.archived;
  result.skipped = writes.skipped;
  result.success = true;

  const durationMs = Date.now() - startedAt;

  logProductWebhook("info", "Product webhook completed", {
    shop: input.shop,
    storeId,
    topic: input.topic,
    webhookId: input.webhookId,
    operation: "webhook_completed",
    shopifyProductId,
    upserted: result.upserted,
    archived: result.archived,
    skipped: result.skipped,
    durationMs,
  });

  logProductWebhook("info", "Product webhook summary", {
    shop: input.shop,
    storeId,
    topic: input.topic,
    webhookId: input.webhookId,
    operation: "webhook_summary",
    shopifyProductId,
    upserted: result.upserted,
    archived: result.archived,
    skipped: result.skipped,
    durationMs,
  });

  return result;
}

async function applyProductWebhookWrites(
  input: ProductWebhookInput,
  storeId: string,
  payload: ShopifyProductWebhookPayload,
  shopifyProductId: string,
  reconcile: boolean,
  db: ProductDbClient,
): Promise<Pick<ProductWebhookResult, "upserted" | "archived" | "skipped">> {
  const variants = payload.variants ?? [];
  const activeVariantIds: string[] = [];
  let upserted = 0;
  let skipped = 0;
  let skippedVariants = 0;

  for (const variant of variants) {
    const row = normalizeWebhookVariantRow(payload, variant);
    if (!row) {
      skipped += 1;
      skippedVariants += 1;
      continue;
    }

    activeVariantIds.push(row.shopifyVariantId);
    const upsertResult = await upsertVariantRow(storeId, row, "webhook", db);

    if (upsertResult.action === "limit_exceeded") {
      skipped += 1;
      skippedVariants += 1;
      logProductWebhook("warn", "Product webhook create blocked by plan limit", {
        shop: input.shop,
        storeId,
        topic: input.topic,
        webhookId: input.webhookId,
        operation: "limit_exceeded",
        reason: BILLING_LIMIT_EXCEEDED,
        shopifyProductId,
      });
      continue;
    }

    if (upsertResult.action === "stale_skipped") {
      continue;
    }

    upserted += 1;
  }

  logProductWebhook("info", "Product webhook variants upserted", {
    shop: input.shop,
    storeId,
    topic: input.topic,
    webhookId: input.webhookId,
    operation: "webhook_upsert",
    shopifyProductId,
    upserted,
    skipped,
  });

  let archived = 0;

  if (reconcile) {
    if (skippedVariants > 0) {
      logProductWebhook("warn", "Product webhook reconcile skipped", {
        shop: input.shop,
        storeId,
        topic: input.topic,
        webhookId: input.webhookId,
        operation: "webhook_reconcile_skipped",
        productId: shopifyProductId,
        skippedVariants,
        payloadVariantCount: variants.length,
      });
    } else {
      archived = await reconcileRemovedVariants(
        storeId,
        shopifyProductId,
        activeVariantIds,
        db,
      );

      if (archived > 0) {
        logProductWebhook("info", "Removed product variants archived", {
          shop: input.shop,
          storeId,
          topic: input.topic,
          webhookId: input.webhookId,
          operation: "webhook_reconcile",
          shopifyProductId,
          archived,
        });
      }
    }
  }

  if (mapProductStatus(payload.status) === "archived") {
    archived += await archiveProductByShopifyId(storeId, shopifyProductId, db);
  }

  return { upserted, archived, skipped };
}

async function upsertProductFromWebhookPayload(
  input: ProductWebhookInput,
  storeId: string,
  reconcile: boolean,
  transactional = false,
): Promise<ProductWebhookResult> {
  const startedAt = Date.now();
  const result: ProductWebhookResult = {
    success: false,
    upserted: 0,
    archived: 0,
    skipped: 0,
  };

  const payload = parseProductWebhookPayload(input.payload);
  if (!payload) {
    logProductWebhook("warn", "Invalid product webhook payload", {
      shop: input.shop,
      storeId,
      topic: input.topic,
      webhookId: input.webhookId,
      operation: "webhook_skipped",
      reason: "invalid_payload",
    });
    result.success = true;
    result.skipped += 1;
    return result;
  }

  const shopifyProductId = resolveShopifyProductId(payload);
  if (!shopifyProductId || !payload.title) {
    logProductWebhook("warn", "Product webhook missing required fields", {
      shop: input.shop,
      storeId,
      topic: input.topic,
      webhookId: input.webhookId,
      operation: "webhook_skipped",
      reason: "missing_product_fields",
    });
    result.success = true;
    result.skipped += 1;
    return result;
  }

  result.shopifyProductId = shopifyProductId;
  const variants = payload.variants ?? [];

  if (variants.length === 0) {
    logProductWebhook("warn", "Product webhook has zero variants", {
      shop: input.shop,
      storeId,
      topic: input.topic,
      webhookId: input.webhookId,
      operation: "zero_variants",
      reason: shopifyProductId,
      shopifyProductId,
    });
    result.success = true;
    return result;
  }

  const writes = transactional
    ? await prisma.$transaction(async (tx) =>
        applyProductWebhookWrites(
          input,
          storeId,
          payload,
          shopifyProductId,
          reconcile,
          tx,
        ),
      )
    : await applyProductWebhookWrites(
        input,
        storeId,
        payload,
        shopifyProductId,
        reconcile,
        prisma,
      );

  result.upserted = writes.upserted;
  result.archived = writes.archived;
  result.skipped = writes.skipped;

  result.success = true;
  const durationMs = Date.now() - startedAt;

  logProductWebhook("info", "Product webhook completed", {
    shop: input.shop,
    storeId,
    topic: input.topic,
    webhookId: input.webhookId,
    operation: "webhook_completed",
    shopifyProductId,
    upserted: result.upserted,
    archived: result.archived,
    skipped: result.skipped,
    durationMs,
  });

  logProductWebhook("info", "Product webhook summary", {
    shop: input.shop,
    storeId,
    topic: input.topic,
    webhookId: input.webhookId,
    operation: "webhook_summary",
    shopifyProductId,
    upserted: result.upserted,
    archived: result.archived,
    skipped: result.skipped,
    durationMs,
  });

  return result;
}

export async function handleProductCreateWebhook(
  input: ProductWebhookInput,
): Promise<ProductWebhookResult> {
  logProductWebhook("info", "Product webhook received", {
    shop: input.shop,
    topic: input.topic,
    webhookId: input.webhookId,
    operation: "webhook_received",
  });

  const begin = await beginProductWebhook(input);

  if (begin.kind === "retryable") {
    return {
      success: false,
      upserted: 0,
      archived: 0,
      skipped: 0,
      retryable: true,
      reason: begin.reason,
    };
  }

  if (begin.kind === "duplicate") {
    return productWebhookSkippedResult();
  }

  if (begin.kind === "inactive") {
    return productWebhookInactiveResult();
  }

  if (begin.kind === "lease_retry") {
    return productWebhookLeaseRetryResult(begin.reason);
  }

  try {
    const result = await upsertProductFromWebhookPayload(
      input,
      begin.storeId,
      false,
      true,
    );

    if (begin.eventId) {
      await markWebhookEventProcessed(begin.eventId, begin.processingOwner);
    }

    return result;
  } catch (error) {
    if (begin.eventId && begin.kind === "ready") {
      await finalizeWebhookClaim(begin.eventId, false, begin.processingOwner);
    }

    logProductWebhook("error", "Product create webhook failed", {
      shop: input.shop,
      storeId: begin.storeId,
      topic: input.topic,
      webhookId: input.webhookId,
      operation: "webhook_failed",
      reason: error instanceof Error ? error.message : "unknown_error",
    });
    throw error;
  }
}

export async function handleProductUpdateWebhook(
  input: ProductWebhookInput,
): Promise<ProductWebhookResult> {
  logProductWebhook("info", "Product webhook received", {
    shop: input.shop,
    topic: input.topic,
    webhookId: input.webhookId,
    operation: "webhook_received",
  });

  const begin = await beginProductWebhook(input);

  if (begin.kind === "retryable") {
    return {
      success: false,
      upserted: 0,
      archived: 0,
      skipped: 0,
      retryable: true,
      reason: begin.reason,
    };
  }

  if (begin.kind === "duplicate") {
    return productWebhookSkippedResult();
  }

  if (begin.kind === "inactive") {
    return productWebhookInactiveResult();
  }

  if (begin.kind === "lease_retry") {
    return productWebhookLeaseRetryResult(begin.reason);
  }

  try {
    const result = await upsertProductFromWebhookGraphql(input, begin.storeId);

    if (
      result.skipReason &&
      classifyProductWebhookSkip(result.skipReason) === "retriable"
    ) {
      await finalizeWebhookClaim(begin.eventId, false, begin.processingOwner);
      return {
        success: false,
        upserted: 0,
        archived: 0,
        skipped: 0,
        retryable: true,
        reason: result.skipReason,
      };
    }

    if (begin.eventId) {
      await markWebhookEventProcessed(begin.eventId, begin.processingOwner);
    }

    return result;
  } catch (error) {
    await finalizeWebhookClaim(begin.eventId, false, begin.processingOwner);

    logProductWebhook("error", "Product update webhook failed", {
      shop: input.shop,
      storeId: begin.storeId,
      topic: input.topic,
      webhookId: input.webhookId,
      operation: "graphql_fetch_failed",
      reason: error instanceof Error ? error.message : "unknown_error",
    });

    return {
      success: false,
      upserted: 0,
      archived: 0,
      skipped: 0,
      retryable: true,
      reason: "graphql_fetch_failed",
    };
  }
}

export async function handleProductDeleteWebhook(
  input: ProductWebhookInput,
): Promise<ProductWebhookResult> {
  const startedAt = Date.now();

  logProductWebhook("info", "Product webhook received", {
    shop: input.shop,
    topic: input.topic,
    webhookId: input.webhookId,
    operation: "webhook_received",
  });

  const begin = await beginProductWebhook(input);

  if (begin.kind === "retryable") {
    return {
      success: false,
      upserted: 0,
      archived: 0,
      skipped: 0,
      retryable: true,
      reason: begin.reason,
    };
  }

  if (begin.kind === "duplicate") {
    return productWebhookSkippedResult();
  }

  if (begin.kind === "inactive") {
    return productWebhookInactiveResult();
  }

  if (begin.kind === "lease_retry") {
    return productWebhookLeaseRetryResult(begin.reason);
  }

  const payload = parseProductWebhookPayload(input.payload);
  const shopifyProductId = payload ? resolveShopifyProductId(payload) : null;

  if (!shopifyProductId) {
    logProductWebhook("warn", "Product delete webhook missing product id", {
      shop: input.shop,
      storeId: begin.storeId,
      topic: input.topic,
      webhookId: input.webhookId,
      operation: "webhook_skipped",
      reason: "missing_product_id",
    });

    if (begin.eventId) {
      await markWebhookEventProcessed(begin.eventId, begin.processingOwner);
    }

    return {
      success: true,
      upserted: 0,
      archived: 0,
      skipped: 1,
    };
  }

  try {
    const archived = await archiveProductByShopifyId(
      begin.storeId,
      shopifyProductId,
    );

    if (begin.eventId) {
      await markWebhookEventProcessed(begin.eventId, begin.processingOwner);
    }

    logProductWebhook("info", "Product variants archived from delete webhook", {
      shop: input.shop,
      storeId: begin.storeId,
      topic: input.topic,
      webhookId: input.webhookId,
      operation: "webhook_archive",
      shopifyProductId,
      archived,
    });

    const durationMs = Date.now() - startedAt;

    logProductWebhook("info", "Product webhook completed", {
      shop: input.shop,
      storeId: begin.storeId,
      topic: input.topic,
      webhookId: input.webhookId,
      operation: "webhook_completed",
      shopifyProductId,
      archived,
      durationMs,
    });

    logProductWebhook("info", "Product webhook summary", {
      shop: input.shop,
      storeId: begin.storeId,
      topic: input.topic,
      webhookId: input.webhookId,
      operation: "webhook_summary",
      shopifyProductId,
      archived,
      durationMs,
    });

    return {
      success: true,
      upserted: 0,
      archived,
      skipped: 0,
      shopifyProductId,
    };
  } catch (error) {
    await finalizeWebhookClaim(begin.eventId, false, begin.processingOwner);

    logProductWebhook("error", "Product delete webhook failed", {
      shop: input.shop,
      storeId: begin.storeId,
      topic: input.topic,
      webhookId: input.webhookId,
      operation: "webhook_failed",
      reason: error instanceof Error ? error.message : "unknown_error",
    });
    throw error;
  }
}
