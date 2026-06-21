import { Prisma, type ProductStatus } from "@prisma/client";

import prisma from "../db.server";
import type { StoreSyncAdminClient } from "./store.server";

const PRODUCTS_QUERY = `#graphql
  query StorePilotGetProducts($productCursor: String) {
    products(first: 250, after: $productCursor) {
      edges {
        node {
          id
          title
          status
          variants(first: 100) {
            edges {
              node {
                id
                sku
                price
                inventoryQuantity
                inventoryItem {
                  tracked
                }
              }
            }
            pageInfo {
              hasNextPage
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
};

type LogLevel = "info" | "warn" | "error";

type ProductSyncLogContext = {
  shop: string;
  storeId?: string;
  operation:
    | "bootstrap_scheduled"
    | "sync_started"
    | "product_page"
    | "sync_completed"
    | "sync_summary"
    | "sync_failed"
    | "graphql_error"
    | "store_ineligible"
    | "zero_variants";
  reason?: string;
  upserted?: number;
  skipped?: number;
  productsProcessed?: number;
  variantsProcessed?: number;
  productPage?: number;
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
    tracked?: boolean | null;
  } | null;
}

interface ProductNode {
  id?: string | null;
  title?: string | null;
  status?: string | null;
  variants?: {
    edges?: Array<{ node?: ProductVariantNode | null }> | null;
    pageInfo?: {
      hasNextPage?: boolean | null;
    } | null;
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

interface NormalizedVariantRow {
  shopifyProductId: string;
  shopifyVariantId: string;
  title: string;
  sku: string | null;
  status: ProductStatus;
  price: Prisma.Decimal | null;
  inventoryQuantity: number | null;
  inventoryTracked: boolean;
}

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
    title: product.title,
    sku: variant.sku?.trim() ? variant.sku : null,
    status: mapProductStatus(product.status),
    price: variant.price ? new Prisma.Decimal(variant.price) : null,
    inventoryQuantity: variant.inventoryQuantity ?? null,
    inventoryTracked: variant.inventoryItem?.tracked ?? true,
  };
}

export async function upsertVariantRow(
  storeId: string,
  row: NormalizedVariantRow,
): Promise<void> {
  if (process.env.PRODUCT_SYNC_SIMULATE_PRISMA_FAILURE === "1") {
    throw new Error(
      "Simulated Prisma failure (PRODUCT_SYNC_SIMULATE_PRISMA_FAILURE)",
    );
  }

  await prisma.product.upsert({
    where: {
      storeId_shopifyVariantId: {
        storeId,
        shopifyVariantId: row.shopifyVariantId,
      },
    },
    create: {
      storeId,
      shopifyProductId: row.shopifyProductId,
      shopifyVariantId: row.shopifyVariantId,
      title: row.title,
      sku: row.sku,
      status: row.status,
      price: row.price,
      inventoryQuantity: row.inventoryQuantity,
      inventoryTracked: row.inventoryTracked,
    },
    update: {
      shopifyProductId: row.shopifyProductId,
      title: row.title,
      sku: row.sku,
      status: row.status,
      price: row.price,
      inventoryQuantity: row.inventoryQuantity,
      inventoryTracked: row.inventoryTracked,
    },
  });
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

  if (body.errors?.length) {
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

    throw new Error(
      insufficientScope ? "insufficient_scope" : "graphql_errors",
    );
  }

  return body;
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

    while (hasNextPage) {
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
        const variantEdges = product.variants?.edges ?? [];

        if (variantEdges.length === 0) {
          logProductSync("warn", "Product has zero variants", {
            shop,
            storeId,
            operation: "zero_variants",
            reason: product.id,
          });
          continue;
        }

        if (product.variants?.pageInfo?.hasNextPage) {
          logProductSync("warn", "Product has more than 100 variants", {
            shop,
            storeId,
            operation: "product_page",
            reason: "variant_page_truncated",
            productsProcessed: result.productsProcessed,
          });
        }

        for (const variantEdge of variantEdges) {
          const variant = variantEdge.node;
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

          await upsertVariantRow(storeId, row);
          result.upserted += 1;
        }
      }

      hasNextPage = products?.pageInfo?.hasNextPage === true;
      productCursor = products?.pageInfo?.endCursor ?? null;

      if (hasNextPage && !productCursor) {
        throw new Error("missing_product_page_cursor");
      }
    }

    await prisma.store.update({
      where: { id: storeId },
      data: { lastProductsSyncAt: new Date() },
    });

    result.success = true;

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
