import type { Product } from "@prisma/client";

import prisma from "../db.server";
import { unauthenticated } from "../shopify.server";
import { graphqlWithRetry, resolveStoreForWebhook } from "./product.server";
import type { StoreSyncAdminClient } from "./store.server";
import {
  claimWebhookEvent,
  markWebhookEventProcessed,
} from "./webhook.server";

const INVENTORY_ITEM_LEVELS_QUERY = `#graphql
  query StorePilotInventoryItemLevels($id: ID!, $cursor: String) {
    inventoryItem(id: $id) {
      id
      tracked
      variant {
        id
      }
      inventoryLevels(first: 50, after: $cursor) {
        nodes {
          quantities(names: ["available"]) {
            quantity
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


type LogLevel = "info" | "warn" | "error";

export interface ShopifyInventoryLevelWebhookPayload {
  inventory_item_id?: number | string | null;
  location_id?: number | string | null;
  available?: number | null;
  updated_at?: string | null;
  admin_graphql_api_id?: string | null;
}

export type InventoryWebhookInput = {
  shop: string;
  topic: string;
  payload: Record<string, unknown>;
  webhookId: string;
};

export type InventoryWebhookResult = {
  success: boolean;
  duplicate: boolean;
  skipped: boolean;
  updated: number;
  shopifyInventoryItemId?: string;
  totalAvailable?: number | null;
};

type InventoryWebhookLogContext = {
  shop: string;
  storeId?: string;
  topic?: string;
  webhookId?: string;
  operation:
    | "webhook_received"
    | "webhook_claimed"
    | "webhook_duplicate"
    | "webhook_skipped"
    | "variant_resolved"
    | "variant_not_found"
    | "graphql_recompute"
    | "quantity_updated"
    | "webhook_completed"
    | "webhook_failed"
    | "store_ineligible";
  reason?: string;
  shopifyInventoryItemId?: string;
  shopifyVariantId?: string;
  locationId?: string | number;
  totalAvailable?: number | null;
  updated?: number;
  durationMs?: number;
};

interface GraphQlError {
  message?: string;
}

interface InventoryItemLevelsResponse {
  data?: {
    inventoryItem?: {
      id?: string | null;
      tracked?: boolean | null;
      variant?: {
        id?: string | null;
      } | null;
      inventoryLevels?: {
        nodes?: Array<{
          quantities?: Array<{ quantity?: number | null }> | null;
        } | null> | null;
        pageInfo?: {
          hasNextPage?: boolean | null;
          endCursor?: string | null;
        } | null;
      } | null;
    } | null;
  };
  errors?: GraphQlError[];
}

function toShopifyInventoryItemGid(id: string | number): string {
  const value = String(id);
  if (value.startsWith("gid://")) {
    return value;
  }

  return `gid://shopify/InventoryItem/${value}`;
}

export function logInventoryWebhook(
  level: LogLevel,
  message: string,
  context: InventoryWebhookLogContext,
): void {
  const payload = { message, ...context };

  if (level === "error") {
    console.error("[inventory-webhook]", payload);
    return;
  }

  if (level === "warn") {
    console.warn("[inventory-webhook]", payload);
    return;
  }

  console.info("[inventory-webhook]", payload);
}

export function parseInventoryLevelPayload(
  payload: Record<string, unknown>,
): ShopifyInventoryLevelWebhookPayload | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as ShopifyInventoryLevelWebhookPayload;

  if (
    record.inventory_item_id === undefined ||
    record.inventory_item_id === null
  ) {
    return null;
  }

  return record;
}

export async function findProductsByInventoryItemId(
  storeId: string,
  shopifyInventoryItemId: string,
): Promise<Product[]> {
  return prisma.product.findMany({
    where: {
      storeId,
      shopifyInventoryItemId,
    },
  });
}

interface InventoryItemInventoryState {
  totalAvailable: number | null;
  tracked: boolean | null;
}

async function fetchInventoryItemInventoryState(
  admin: StoreSyncAdminClient,
  shopifyInventoryItemId: string,
  context: { shop: string; storeId: string },
): Promise<InventoryItemInventoryState> {
  let cursor: string | null = null;
  let totalAvailable = 0;
  let hasMore = true;
  let tracked: boolean | null = null;

  logInventoryWebhook("info", "Recomputing total inventory via GraphQL", {
    shop: context.shop,
    storeId: context.storeId,
    operation: "graphql_recompute",
    shopifyInventoryItemId,
  });

  while (hasMore) {
    const response = await graphqlWithRetry(
      admin,
      INVENTORY_ITEM_LEVELS_QUERY,
      { id: shopifyInventoryItemId, cursor },
      context,
    );
    const body = (await response.json()) as InventoryItemLevelsResponse;

    if (body.errors?.length) {
      const reason = body.errors
        .map((error) => error.message ?? "unknown")
        .join("; ");
      throw new Error(reason);
    }

    const inventoryItem = body.data?.inventoryItem;
    if (!inventoryItem?.id) {
      return { totalAvailable: null, tracked: null };
    }

    if (tracked === null) {
      tracked = inventoryItem.tracked ?? null;
    }

    const nodes = inventoryItem.inventoryLevels?.nodes ?? [];

    for (const node of nodes) {
      const quantities = node?.quantities ?? [];
      for (const quantity of quantities) {
        totalAvailable += quantity?.quantity ?? 0;
      }
    }

    hasMore = inventoryItem.inventoryLevels?.pageInfo?.hasNextPage === true;
    cursor = inventoryItem.inventoryLevels?.pageInfo?.endCursor ?? null;

    if (hasMore && !cursor) {
      throw new Error("missing_inventory_level_page_cursor");
    }
  }

  return { totalAvailable, tracked };
}

export async function fetchTotalAvailableForInventoryItem(
  admin: StoreSyncAdminClient,
  shopifyInventoryItemId: string,
  context: { shop: string; storeId: string },
): Promise<number | null> {
  const state = await fetchInventoryItemInventoryState(
    admin,
    shopifyInventoryItemId,
    context,
  );
  return state.totalAvailable;
}

async function selfHealInventoryTracked(
  storeId: string,
  shopifyInventoryItemId: string,
): Promise<number> {
  const result = await prisma.product.updateMany({
    where: {
      storeId,
      shopifyInventoryItemId,
      inventoryTracked: false,
    },
    data: { inventoryTracked: true },
  });

  return result.count;
}

export async function updateProductInventoryQuantity(
  storeId: string,
  shopifyInventoryItemId: string,
  totalAvailable: number | null,
): Promise<number> {
  const result = await prisma.product.updateMany({
    where: {
      storeId,
      shopifyInventoryItemId,
      inventoryTracked: true,
    },
    data: {
      inventoryQuantity: totalAvailable,
    },
  });

  await prisma.store.update({
    where: { id: storeId },
    data: { lastInventorySyncAt: new Date() },
  });

  return result.count;
}

async function resolveProductsViaGraphqlFallback(
  storeId: string,
  shop: string,
  shopifyInventoryItemId: string,
  admin: StoreSyncAdminClient,
): Promise<Product[]> {
  const response = await graphqlWithRetry(
    admin,
    INVENTORY_ITEM_LEVELS_QUERY,
    { id: shopifyInventoryItemId, cursor: null },
    { shop, storeId },
  );
  const body = (await response.json()) as InventoryItemLevelsResponse;

  if (body.errors?.length) {
    const reason = body.errors
      .map((error) => error.message ?? "unknown")
      .join("; ");
    throw new Error(reason);
  }

  const variantId = body.data?.inventoryItem?.variant?.id;
  if (!variantId) {
    return [];
  }

  const product = await prisma.product.findUnique({
    where: {
      storeId_shopifyVariantId: {
        storeId,
        shopifyVariantId: variantId,
      },
    },
  });

  if (!product) {
    return [];
  }

  if (product.shopifyInventoryItemId == null) {
    await prisma.product.update({
      where: { id: product.id },
      data: { shopifyInventoryItemId },
    });
  }

  return findProductsByInventoryItemId(storeId, shopifyInventoryItemId);
}

async function completeWebhookSkip(
  input: InventoryWebhookInput,
  storeId: string,
  eventId: string | undefined,
  result: InventoryWebhookResult,
  operation: InventoryWebhookLogContext["operation"],
  reason: string,
  startedAt: number,
): Promise<InventoryWebhookResult> {
  logInventoryWebhook("warn", "Inventory webhook skipped", {
    shop: input.shop,
    storeId,
    topic: input.topic,
    webhookId: input.webhookId,
    operation,
    reason,
    durationMs: Date.now() - startedAt,
  });

  if (eventId) {
    await markWebhookEventProcessed(eventId);
  }

  return {
    ...result,
    success: true,
    skipped: true,
  };
}

export async function handleInventoryLevelUpdateWebhook(
  input: InventoryWebhookInput,
): Promise<InventoryWebhookResult> {
  const startedAt = Date.now();
  const result: InventoryWebhookResult = {
    success: false,
    duplicate: false,
    skipped: false,
    updated: 0,
  };

  logInventoryWebhook("info", "Inventory webhook received", {
    shop: input.shop,
    topic: input.topic,
    webhookId: input.webhookId,
    operation: "webhook_received",
  });

  const store = await resolveStoreForWebhook(input.shop);
  if (!store) {
    logInventoryWebhook("error", "Store is not eligible for inventory webhook", {
      shop: input.shop,
      topic: input.topic,
      webhookId: input.webhookId,
      operation: "store_ineligible",
      reason: "store_not_found_or_inactive",
    });

    return {
      ...result,
      success: true,
      skipped: true,
    };
  }

  const claim = await claimWebhookEvent({
    storeId: store.storeId,
    shop: input.shop,
    topic: input.topic,
    webhookId: input.webhookId,
  });

  if (claim.duplicate) {
    logInventoryWebhook("info", "Duplicate inventory webhook skipped", {
      shop: input.shop,
      storeId: store.storeId,
      topic: input.topic,
      webhookId: input.webhookId,
      operation: "webhook_duplicate",
    });

    return {
      ...result,
      success: true,
      duplicate: true,
      skipped: true,
    };
  }

  logInventoryWebhook("info", "Inventory webhook claimed", {
    shop: input.shop,
    storeId: store.storeId,
    topic: input.topic,
    webhookId: input.webhookId,
    operation: "webhook_claimed",
  });

  try {
    const parsed = parseInventoryLevelPayload(input.payload);
    if (!parsed) {
      return completeWebhookSkip(
        input,
        store.storeId,
        claim.eventId,
        result,
        "webhook_skipped",
        "invalid_payload",
        startedAt,
      );
    }

    const shopifyInventoryItemId = toShopifyInventoryItemGid(
      parsed.inventory_item_id!,
    );
    result.shopifyInventoryItemId = shopifyInventoryItemId;

    let products = await findProductsByInventoryItemId(
      store.storeId,
      shopifyInventoryItemId,
    );

    const { admin } = await unauthenticated.admin(input.shop);

    if (products.length === 0) {
      products = await resolveProductsViaGraphqlFallback(
        store.storeId,
        input.shop,
        shopifyInventoryItemId,
        admin,
      );
    }

    if (products.length === 0) {
      logInventoryWebhook("warn", "No product rows resolved for inventory item", {
        shop: input.shop,
        storeId: store.storeId,
        topic: input.topic,
        webhookId: input.webhookId,
        operation: "variant_not_found",
        shopifyInventoryItemId,
        locationId: parsed.location_id ?? undefined,
      });

      if (claim.eventId) {
        await markWebhookEventProcessed(claim.eventId);
      }

      return {
        ...result,
        success: true,
        skipped: true,
      };
    }

    logInventoryWebhook("info", "Inventory webhook variants resolved", {
      shop: input.shop,
      storeId: store.storeId,
      topic: input.topic,
      webhookId: input.webhookId,
      operation: "variant_resolved",
      shopifyInventoryItemId,
      shopifyVariantId: products[0]?.shopifyVariantId,
      updated: products.length,
    });

    const inventoryState = await fetchInventoryItemInventoryState(
      admin,
      shopifyInventoryItemId,
      { shop: input.shop, storeId: store.storeId },
    );

    if (inventoryState.tracked !== true) {
      return completeWebhookSkip(
        input,
        store.storeId,
        claim.eventId,
        result,
        "webhook_skipped",
        "inventory_not_tracked",
        startedAt,
      );
    }

    const healedCount = await selfHealInventoryTracked(
      store.storeId,
      shopifyInventoryItemId,
    );

    if (healedCount > 0) {
      logInventoryWebhook("info", "Inventory tracked flag self-healed", {
        shop: input.shop,
        storeId: store.storeId,
        topic: input.topic,
        webhookId: input.webhookId,
        operation: "variant_resolved",
        shopifyInventoryItemId,
        reason: "inventory_tracked_self_healed",
        updated: healedCount,
      });
    }

    if (inventoryState.totalAvailable === null) {
      return completeWebhookSkip(
        input,
        store.storeId,
        claim.eventId,
        result,
        "webhook_skipped",
        "inventory_item_not_found_in_graphql",
        startedAt,
      );
    }

    result.totalAvailable = inventoryState.totalAvailable;

    const updatedCount = await updateProductInventoryQuantity(
      store.storeId,
      shopifyInventoryItemId,
      inventoryState.totalAvailable,
    );
    result.updated = updatedCount;

    logInventoryWebhook("info", "Inventory quantity updated", {
      shop: input.shop,
      storeId: store.storeId,
      topic: input.topic,
      webhookId: input.webhookId,
      operation: "quantity_updated",
      shopifyInventoryItemId,
      totalAvailable: inventoryState.totalAvailable,
      updated: updatedCount,
      locationId: parsed.location_id ?? undefined,
    });

    if (claim.eventId) {
      await markWebhookEventProcessed(claim.eventId);
    }

    const durationMs = Date.now() - startedAt;

    logInventoryWebhook("info", "Inventory webhook completed", {
      shop: input.shop,
      storeId: store.storeId,
      topic: input.topic,
      webhookId: input.webhookId,
      operation: "webhook_completed",
      shopifyInventoryItemId,
      totalAvailable: inventoryState.totalAvailable,
      updated: updatedCount,
      durationMs,
    });

    return {
      ...result,
      success: true,
    };
  } catch (error) {
    logInventoryWebhook("error", "Inventory webhook failed", {
      shop: input.shop,
      storeId: store.storeId,
      topic: input.topic,
      webhookId: input.webhookId,
      operation: "webhook_failed",
      reason: error instanceof Error ? error.message : "unknown_error",
      durationMs: Date.now() - startedAt,
    });
    throw error;
  }
}
