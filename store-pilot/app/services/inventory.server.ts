import type { Product } from "@prisma/client";

import prisma from "../db.server";
import { unauthenticated } from "../shopify.server";
import { graphqlWithRetry } from "./product.server";
import type { StoreSyncAdminClient } from "./store.server";
import {
  classifyInventoryWebhookSkip,
  finalizeWebhookClaim,
  gateWebhookEvent,
  lookupStoreForWebhook,
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
  retryable?: boolean;
  reason?: string;
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
  processingOwner: string,
  result: InventoryWebhookResult,
  operation: InventoryWebhookLogContext["operation"],
  reason: string,
  startedAt: number,
): Promise<InventoryWebhookResult> {
  if (classifyInventoryWebhookSkip(reason) === "retriable") {
    logInventoryWebhook("warn", "Inventory webhook retriable skip", {
      shop: input.shop,
      storeId,
      topic: input.topic,
      webhookId: input.webhookId,
      operation,
      reason,
      durationMs: Date.now() - startedAt,
    });

    await finalizeWebhookClaim(eventId, false, processingOwner);
    throw new Error(`retriable_inventory_webhook_skip:${reason}`);
  }

  logInventoryWebhook("warn", "Inventory webhook skipped", {
    shop: input.shop,
    storeId,
    topic: input.topic,
    webhookId: input.webhookId,
    operation,
    reason,
    durationMs: Date.now() - startedAt,
  });

  await finalizeWebhookClaim(eventId, true, processingOwner);

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

  const lookup = await lookupStoreForWebhook(input.shop);

  if (!lookup) {
    logInventoryWebhook("warn", "Store not found for inventory webhook", {
      shop: input.shop,
      topic: input.topic,
      webhookId: input.webhookId,
      operation: "store_ineligible",
      reason: "store_not_found",
    });

    return {
      ...result,
      success: false,
      retryable: true,
      reason: "store_not_found",
    };
  }

  const gate = await gateWebhookEvent({
    shop: input.shop,
    topic: input.topic,
    webhookId: input.webhookId,
    lookup,
  });

  if (gate.outcome === "duplicate") {
    logInventoryWebhook("info", "Duplicate inventory webhook skipped", {
      shop: input.shop,
      storeId: lookup.storeId,
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

  if (gate.outcome === "lease_retry") {
    logInventoryWebhook("info", "Inventory webhook deferred for lease contention", {
      shop: input.shop,
      storeId: gate.storeId,
      topic: input.topic,
      webhookId: input.webhookId,
      operation: "webhook_skipped",
      reason: gate.reason,
    });

    return {
      ...result,
      success: false,
      skipped: true,
      retryable: true,
      reason: gate.reason,
    };
  }

  if (gate.outcome === "inactive_retry") {
    logInventoryWebhook("info", "Inventory webhook deferred for inactive store", {
      shop: input.shop,
      storeId: gate.storeId,
      topic: input.topic,
      webhookId: input.webhookId,
      operation: "webhook_skipped",
      reason: "store_inactive",
    });

    return {
      ...result,
      success: false,
      skipped: true,
      retryable: true,
      reason: "store_inactive",
    };
  }

  if (gate.outcome !== "ready") {
    return {
      ...result,
      success: false,
      skipped: true,
      retryable: true,
      reason: "webhook_gate_not_ready",
    };
  }

  const storeId = gate.storeId;
  const eventId = gate.eventId;
  const processingOwner = gate.processingOwner;

  logInventoryWebhook("info", "Inventory webhook claimed", {
    shop: input.shop,
    storeId,
    topic: input.topic,
    webhookId: input.webhookId,
    operation: "webhook_claimed",
  });

  try {
    const parsed = parseInventoryLevelPayload(input.payload);
    if (!parsed) {
      return completeWebhookSkip(
        input,
        storeId,
        eventId,
        processingOwner,
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
      storeId,
      shopifyInventoryItemId,
    );

    const { admin } = await unauthenticated.admin(input.shop);

    if (products.length === 0) {
      products = await resolveProductsViaGraphqlFallback(
        storeId,
        input.shop,
        shopifyInventoryItemId,
        admin,
      );
    }

    if (products.length === 0) {
      logInventoryWebhook("warn", "No product rows resolved for inventory item", {
        shop: input.shop,
        storeId,
        topic: input.topic,
        webhookId: input.webhookId,
        operation: "variant_not_found",
        shopifyInventoryItemId,
        locationId: parsed.location_id ?? undefined,
      });

      throw new Error("retriable_inventory_webhook_skip:variant_not_found");
    }

    logInventoryWebhook("info", "Inventory webhook variants resolved", {
      shop: input.shop,
      storeId,
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
      { shop: input.shop, storeId },
    );

    if (inventoryState.totalAvailable === null) {
      return completeWebhookSkip(
        input,
        storeId,
        eventId,
        processingOwner,
        result,
        "webhook_skipped",
        "inventory_item_not_found_in_graphql",
        startedAt,
      );
    }

    if (inventoryState.tracked !== true) {
      return completeWebhookSkip(
        input,
        storeId,
        eventId,
        processingOwner,
        result,
        "webhook_skipped",
        "inventory_not_tracked",
        startedAt,
      );
    }

    const healedCount = await selfHealInventoryTracked(
      storeId,
      shopifyInventoryItemId,
    );

    if (healedCount > 0) {
      logInventoryWebhook("info", "Inventory tracked flag self-healed", {
        shop: input.shop,
        storeId,
        topic: input.topic,
        webhookId: input.webhookId,
        operation: "variant_resolved",
        shopifyInventoryItemId,
        reason: "inventory_tracked_self_healed",
        updated: healedCount,
      });
    }

    result.totalAvailable = inventoryState.totalAvailable;

    const updatedCount = await updateProductInventoryQuantity(
      storeId,
      shopifyInventoryItemId,
      inventoryState.totalAvailable,
    );
    result.updated = updatedCount;

    if (updatedCount === 0) {
      return completeWebhookSkip(
        input,
        storeId,
        eventId,
        processingOwner,
        result,
        "webhook_skipped",
        "inventory_quantity_not_updated",
        startedAt,
      );
    }

    logInventoryWebhook("info", "Inventory quantity updated", {
      shop: input.shop,
      storeId,
      topic: input.topic,
      webhookId: input.webhookId,
      operation: "quantity_updated",
      shopifyInventoryItemId,
      totalAvailable: inventoryState.totalAvailable,
      updated: updatedCount,
      locationId: parsed.location_id ?? undefined,
    });

    await finalizeWebhookClaim(eventId, true, processingOwner);

    const durationMs = Date.now() - startedAt;

    logInventoryWebhook("info", "Inventory webhook completed", {
      shop: input.shop,
      storeId,
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
    await finalizeWebhookClaim(eventId, false, processingOwner);

    logInventoryWebhook("error", "Inventory webhook failed", {
      shop: input.shop,
      storeId,
      topic: input.topic,
      webhookId: input.webhookId,
      operation: "webhook_failed",
      reason: error instanceof Error ? error.message : "unknown_error",
      durationMs: Date.now() - startedAt,
    });
    throw error;
  }
}

export type SyncInventoryInput = {
  storeId: string;
  shop: string;
  admin: StoreSyncAdminClient;
};

export type SyncInventoryResult = {
  success: boolean;
  inventoryItemsProcessed: number;
  variantsUpdated: number;
  skipped: number;
};

export async function syncInventoryFromShopify(
  input: SyncInventoryInput,
): Promise<SyncInventoryResult> {
  const store = await prisma.store.findUnique({
    where: { id: input.storeId },
    select: { id: true, active: true },
  });

  if (!store?.active) {
    logInventoryWebhook("error", "Inventory bootstrap sync store ineligible", {
      shop: input.shop,
      storeId: input.storeId,
      operation: "store_ineligible",
      reason: !store ? "store_not_found" : "store_inactive",
    });
    return {
      success: false,
      inventoryItemsProcessed: 0,
      variantsUpdated: 0,
      skipped: 0,
    };
  }

  const products = await prisma.product.findMany({
    where: {
      storeId: input.storeId,
      inventoryTracked: true,
      shopifyInventoryItemId: {
        not: null,
      },
    },
    select: {
      shopifyInventoryItemId: true,
    },
  });

  const inventoryItemIds = [
    ...new Set(
      products
        .map((product) => product.shopifyInventoryItemId)
        .filter((itemId): itemId is string => itemId !== null),
    ),
  ];

  let variantsUpdated = 0;
  let skipped = 0;

  for (const shopifyInventoryItemId of inventoryItemIds) {
    const totalAvailable = await fetchTotalAvailableForInventoryItem(
      input.admin,
      shopifyInventoryItemId,
      {
        shop: input.shop,
        storeId: input.storeId,
      },
    );

    if (totalAvailable === null) {
      skipped += 1;
      continue;
    }

    variantsUpdated += await updateProductInventoryQuantity(
      input.storeId,
      shopifyInventoryItemId,
      totalAvailable,
    );
  }

  return {
    success: skipped === 0,
    inventoryItemsProcessed: inventoryItemIds.length,
    variantsUpdated,
    skipped,
  };
}
