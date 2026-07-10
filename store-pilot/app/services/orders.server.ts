import { Prisma } from "@prisma/client";

import prisma from "../db.server";
import { markPhaseBlocked } from "./onboarding.server";
import { unauthenticated } from "../shopify.server";
import {
  assertOrderCreateAllowedAtomic,
  BILLING_LIMIT_EXCEEDED,
  checkOrderCreateAllowed,
  runOrderCreateWithAtomicLimit,
  toBillingLimitBlockedState,
} from "./billing-enforcement.server";
import { graphqlWithRetry } from "./product.server";
import type { StoreSyncAdminClient } from "./store.server";
import {
  classifyOrderWebhookSkip,
  finalizeWebhookClaim,
  gateWebhookEvent,
  lookupStoreForWebhook,
} from "./webhook.server";
import { scheduleGraphUpdateFromWebhook } from "./knowledge-graph-webhook.server";

export type OrdersDbClient = Pick<typeof prisma, "order" | "orderLineItem">;

const ORDERS_PAGE_SIZE = 250;
const HISTORICAL_ORDERS_DAYS = 90;

export type OrderSyncAdminClient = StoreSyncAdminClient;

export interface SyncOrdersResult {
  success: boolean;
  blocked?: boolean;
  blockedReason?: string;
  blockedMessage?: string;
  orderPages: number;
  ordersProcessed: number;
  lineItemsProcessed: number;
  upserted: number;
  skipped: number;
  skippedOrderIds?: string[];
  quarantinedOrderIds?: string[];
}

const ORDERS_SYNC_STATE_PREFIX = "sp-sync:v1:";

export type OrdersSyncCursorState = {
  pageCursor: string | null;
  quarantinedOrderIds: string[];
  historicalPagesComplete: boolean;
};

export function parseOrdersSyncCursorState(
  raw: string | null | undefined,
): OrdersSyncCursorState {
  if (!raw) {
    return {
      pageCursor: null,
      quarantinedOrderIds: [],
      historicalPagesComplete: false,
    };
  }

  if (!raw.startsWith(ORDERS_SYNC_STATE_PREFIX)) {
    return {
      pageCursor: raw,
      quarantinedOrderIds: [],
      historicalPagesComplete: false,
    };
  }

  try {
    const parsed = JSON.parse(
      raw.slice(ORDERS_SYNC_STATE_PREFIX.length),
    ) as Partial<OrdersSyncCursorState>;

    return {
      pageCursor: parsed.pageCursor ?? null,
      quarantinedOrderIds: Array.isArray(parsed.quarantinedOrderIds)
        ? parsed.quarantinedOrderIds
        : [],
      historicalPagesComplete: parsed.historicalPagesComplete === true,
    };
  } catch {
    return {
      pageCursor: null,
      quarantinedOrderIds: [],
      historicalPagesComplete: false,
    };
  }
}

export function serializeOrdersSyncCursorState(
  state: OrdersSyncCursorState,
): string | null {
  if (
    !state.pageCursor &&
    state.quarantinedOrderIds.length === 0 &&
    !state.historicalPagesComplete
  ) {
    return null;
  }

  if (
    state.quarantinedOrderIds.length === 0 &&
    !state.historicalPagesComplete &&
    state.pageCursor
  ) {
    return state.pageCursor;
  }

  return `${ORDERS_SYNC_STATE_PREFIX}${JSON.stringify(state)}`;
}

function mergeQuarantinedOrderIds(
  existing: string[],
  added: string[],
): string[] {
  const merged = new Set(existing);
  for (const orderId of added) {
    merged.add(orderId);
  }
  return [...merged];
}

function recordSkippedOrder(
  result: SyncOrdersResult,
  shopifyOrderId?: string | null,
): void {
  result.skipped += 1;

  if (!shopifyOrderId) {
    return;
  }

  if (!result.skippedOrderIds) {
    result.skippedOrderIds = [];
  }

  if (!result.skippedOrderIds.includes(shopifyOrderId)) {
    result.skippedOrderIds.push(shopifyOrderId);
  }
}

export type SyncOrdersInput = {
  storeId: string;
  shop: string;
  admin: OrderSyncAdminClient;
};

export type OrderWebhookInput = {
  shop: string;
  topic: string;
  payload: Record<string, unknown>;
  webhookId: string;
};

export type OrderWebhookResult = {
  success: boolean;
  skipped: boolean;
  shopifyOrderId?: string;
  skipReason?: string;
  retryable?: boolean;
  reason?: string;
};

type OrderWebhookLogContext = {
  shop: string;
  storeId?: string;
  topic?: string;
  webhookId?: string;
  operation:
    | "order_webhook_received"
    | "order_webhook_processed"
    | "order_webhook_skipped"
    | "order_webhook_failed"
    | "store_ineligible"
    | "limit_exceeded";
  reason?: string;
  shopifyOrderId?: string;
};

interface ShopifyOrderWebhookPayload {
  admin_graphql_api_id?: string | null;
  id?: number | string | null;
}

interface OrderByIdQueryResponse {
  data?: {
    order?: OrderNode | null;
  };
  errors?: GraphQlError[];
}

interface OrderLineItemsQueryResponse {
  data?: {
    order?: {
      id?: string | null;
      lineItems?: {
        edges?: Array<{ node?: OrderLineItemNode | null }> | null;
        pageInfo?: OrdersPageInfo | null;
      } | null;
    } | null;
  };
  errors?: GraphQlError[];
}

function logOrderWebhook(
  level: LogLevel,
  message: string,
  context: OrderWebhookLogContext,
): void {
  const payload = { message, ...context };

  if (level === "error") {
    console.error("[order-webhook]", payload);
    return;
  }

  if (level === "warn") {
    console.warn("[order-webhook]", payload);
    return;
  }

  console.info("[order-webhook]", payload);
}

function resolveShopifyOrderGid(
  payload: Record<string, unknown>,
): string | null {
  const order = payload as ShopifyOrderWebhookPayload;
  const graphqlId = order.admin_graphql_api_id;

  if (graphqlId?.startsWith("gid://")) {
    return graphqlId;
  }

  if (order.id != null) {
    return `gid://shopify/Order/${order.id}`;
  }

  return null;
}

async function fetchRemainingOrderLineItems(
  admin: OrderSyncAdminClient,
  shop: string,
  storeId: string,
  orderGid: string,
  order: OrderNode,
): Promise<number> {
  let lineItemPages = 1;
  let hasNextPage = order.lineItems?.pageInfo?.hasNextPage === true;
  let lineItemCursor = order.lineItems?.pageInfo?.endCursor ?? null;

  while (hasNextPage) {
    if (!lineItemCursor) {
      throw new Error("missing_order_line_item_cursor");
    }

    const response = await graphqlWithRetry(
      admin,
      ORDER_LINE_ITEMS_QUERY,
      { id: orderGid, cursor: lineItemCursor },
      { shop, storeId },
    );
    const body = (await response.json()) as OrderLineItemsQueryResponse;

    handleOrdersGraphqlErrors(body, shop, storeId);

    const lineItems = body.data?.order?.lineItems;
    order.lineItems = {
      edges: [...(order.lineItems?.edges ?? []), ...(lineItems?.edges ?? [])],
      pageInfo: lineItems?.pageInfo ?? null,
    };

    lineItemPages += 1;
    hasNextPage = lineItems?.pageInfo?.hasNextPage === true;
    lineItemCursor = lineItems?.pageInfo?.endCursor ?? null;
  }

  return lineItemPages;
}

function countShopifyOrderLineItemNodes(order: OrderNode): number {
  return (order.lineItems?.edges ?? []).filter(
    (lineEdge) => lineEdge?.node != null,
  ).length;
}

function logOrderLineItemPagesLoaded(
  shop: string,
  storeId: string,
  shopifyOrderId: string,
  order: OrderNode,
  lineItemPages: number,
): void {
  if (lineItemPages <= 1) {
    return;
  }

  logOrdersSync("info", "Order line item pages loaded", {
    shop,
    storeId,
    operation: "order_line_item_pages_loaded",
    shopifyOrderId,
    lineItemCount: countShopifyOrderLineItemNodes(order),
    lineItemPages,
  });
}

async function ensureCompleteOrderLineItems(
  admin: OrderSyncAdminClient,
  shop: string,
  storeId: string,
  order: OrderNode,
): Promise<boolean> {
  if (!order.id) {
    return false;
  }

  if (order.lineItems?.pageInfo?.hasNextPage !== true) {
    return true;
  }

  try {
    const lineItemPages = await fetchRemainingOrderLineItems(
      admin,
      shop,
      storeId,
      order.id,
      order,
    );
    logOrderLineItemPagesLoaded(shop, storeId, order.id, order, lineItemPages);
    return true;
  } catch (error) {
    logOrdersSync("warn", "Order line item pagination failed", {
      shop,
      storeId,
      operation: "order_reconcile_skipped",
      reason: "line_item_pagination_failed",
      shopifyOrderId: order.id,
    });
    return false;
  }
}

export async function fetchOrderById(
  admin: OrderSyncAdminClient,
  shop: string,
  storeId: string,
  orderGid: string,
): Promise<OrderNode | null> {
  const response = await graphqlWithRetry(
    admin,
    ORDER_BY_ID_QUERY,
    { id: orderGid },
    { shop, storeId },
  );
  const body = (await response.json()) as OrderByIdQueryResponse;

  handleOrdersGraphqlErrors(body, shop, storeId);

  const order = body.data?.order;
  if (!order) {
    return null;
  }

  const lineItemPages = await fetchRemainingOrderLineItems(
    admin,
    shop,
    storeId,
    orderGid,
    order,
  );
  logOrderLineItemPagesLoaded(shop, storeId, orderGid, order, lineItemPages);

  return order;
}

async function upsertOrderFromWebhookGraphql(
  input: OrderWebhookInput,
  storeId: string,
): Promise<OrderWebhookResult> {
  const shopifyOrderId = resolveShopifyOrderGid(input.payload);
  if (!shopifyOrderId) {
    logOrderWebhook("warn", "Order webhook missing order id", {
      shop: input.shop,
      storeId,
      topic: input.topic,
      webhookId: input.webhookId,
      operation: "order_webhook_skipped",
      reason: "missing_order_id",
    });

    return {
      success: true,
      skipped: true,
      skipReason: "missing_order_id",
    };
  }

  const { admin } = await unauthenticated.admin(input.shop);
  const order = await fetchOrderById(
    admin,
    input.shop,
    storeId,
    shopifyOrderId,
  );

  if (!order?.id) {
    logOrderWebhook("warn", "Order webhook order not found in GraphQL", {
      shop: input.shop,
      storeId,
      topic: input.topic,
      webhookId: input.webhookId,
      operation: "order_webhook_skipped",
      reason: "order_not_found",
      shopifyOrderId,
    });

    return {
      success: true,
      skipped: true,
      shopifyOrderId,
      skipReason: "order_not_found",
    };
  }

  const normalizedOrder = normalizeOrderRow(order, {
    shop: input.shop,
    storeId,
  });
  if (!normalizedOrder) {
    logOrderWebhook("warn", "Order webhook normalization failed", {
      shop: input.shop,
      storeId,
      topic: input.topic,
      webhookId: input.webhookId,
      operation: "order_webhook_skipped",
      reason: "normalize_failed",
      shopifyOrderId,
    });

    return {
      success: true,
      skipped: true,
      shopifyOrderId,
      skipReason: "normalize_failed",
    };
  }

  const shopifyLineItemCount = (order.lineItems?.edges ?? []).filter(
    (lineEdge) => lineEdge?.node != null,
  ).length;
  const normalizedLineItems = collectNormalizedOrderLineItems(order);
  const reconcileSafe =
    normalizedLineItems.length > 0 &&
    normalizedLineItems.length === shopifyLineItemCount;

  const limitSkipped = await prisma.$transaction(async (tx) => {
    const upsertResult = await upsertOrderWithLineItems(
      storeId,
      normalizedOrder,
      normalizedLineItems,
      tx,
      reconcileSafe,
      shopifyLineItemCount,
    );

    if (upsertResult.limitExceeded) {
      logOrderWebhook("warn", "Order webhook create blocked by plan limit", {
        shop: input.shop,
        storeId,
        topic: input.topic,
        webhookId: input.webhookId,
        operation: "limit_exceeded",
        reason: BILLING_LIMIT_EXCEEDED,
        shopifyOrderId,
      });
      return "limit_exceeded" as const;
    }

    if (upsertResult.staleSkipped) {
      logOrderWebhook("info", "Order webhook skipped stale header without line-item writes", {
        shop: input.shop,
        storeId,
        topic: input.topic,
        webhookId: input.webhookId,
        operation: "order_webhook_skipped",
        reason: "stale_order_header",
        shopifyOrderId,
      });
      return "stale_order_header" as const;
    }

    return null;
  });

  if (limitSkipped === "limit_exceeded") {
    return {
      success: false,
      skipped: true,
      shopifyOrderId,
      skipReason: "limit_exceeded",
      retryable: true,
      reason: "limit_exceeded",
    };
  }

  if (limitSkipped === "stale_order_header") {
    return {
      success: true,
      skipped: true,
      shopifyOrderId,
      skipReason: "stale_order_header",
    };
  }

  logOrderWebhook("info", "Order webhook processed", {
    shop: input.shop,
    storeId,
    topic: input.topic,
    webhookId: input.webhookId,
    operation: "order_webhook_processed",
    shopifyOrderId,
  });

  return {
    success: true,
    skipped: false,
    shopifyOrderId,
  };
}

async function handleOrderWebhook(
  input: OrderWebhookInput,
): Promise<OrderWebhookResult> {
  logOrderWebhook("info", "Order webhook received", {
    shop: input.shop,
    topic: input.topic,
    webhookId: input.webhookId,
    operation: "order_webhook_received",
  });

  const lookup = await lookupStoreForWebhook(input.shop);

  if (!lookup) {
    logOrderWebhook("warn", "Store not found for order webhook", {
      shop: input.shop,
      topic: input.topic,
      webhookId: input.webhookId,
      operation: "store_ineligible",
      reason: "store_not_found",
    });

    return {
      success: false,
      skipped: true,
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
    return {
      success: true,
      skipped: true,
    };
  }

  if (gate.outcome === "lease_retry") {
    logOrderWebhook("info", "Order webhook deferred for lease contention", {
      shop: input.shop,
      storeId: gate.storeId,
      topic: input.topic,
      webhookId: input.webhookId,
      operation: "order_webhook_skipped",
      reason: gate.reason,
    });

    return {
      success: false,
      skipped: true,
      retryable: true,
      reason: gate.reason,
    };
  }

  if (gate.outcome === "inactive_retry") {
    logOrderWebhook("info", "Order webhook deferred for inactive store", {
      shop: input.shop,
      storeId: gate.storeId,
      topic: input.topic,
      webhookId: input.webhookId,
      operation: "order_webhook_skipped",
      reason: "store_inactive",
    });

    return {
      success: false,
      skipped: true,
      retryable: true,
      reason: "store_inactive",
    };
  }

  if (gate.outcome !== "ready") {
    return {
      success: false,
      skipped: true,
      retryable: true,
      reason: "webhook_gate_not_ready",
    };
  }

  const storeId = gate.storeId;
  const eventId = gate.eventId;
  const processingOwner = gate.processingOwner;

  try {
    const result = await upsertOrderFromWebhookGraphql(input, storeId);

    if (
      result.skipped &&
      result.skipReason &&
      classifyOrderWebhookSkip(result.skipReason) === "retriable"
    ) {
      throw new Error(
        `retriable_order_webhook_skip:${result.skipReason}`,
      );
    }

    if (result.retryable) {
      throw new Error(`retriable_order_webhook_skip:${result.reason ?? "limit_exceeded"}`);
    }

    await finalizeWebhookClaim(eventId, true, processingOwner);

    void scheduleGraphUpdateFromWebhook({
      storeId,
      topic: input.topic,
      payload: input.payload,
    }).catch(() => undefined);

    return result;
  } catch (error) {
    const blocked = classifyPermanentOrdersAccessFailure(
      error instanceof Error ? error.message : String(error),
    );

    if (blocked) {
      await markPhaseBlocked(
        storeId,
        "ORDERS",
        blocked.blockedReason,
        blocked.blockedMessage,
      );
      await finalizeWebhookClaim(eventId, true, processingOwner);

      logOrderWebhook("warn", "Order webhook blocked by permanent access failure", {
        shop: input.shop,
        storeId,
        topic: input.topic,
        webhookId: input.webhookId,
        operation: "order_webhook_skipped",
        reason: blocked.blockedReason,
      });

      return {
        success: true,
        skipped: true,
        skipReason: blocked.blockedReason,
      };
    }

    await finalizeWebhookClaim(eventId, false, processingOwner);

    logOrderWebhook("error", "Order webhook failed", {
      shop: input.shop,
      storeId,
      topic: input.topic,
      webhookId: input.webhookId,
      operation: "order_webhook_failed",
      reason: error instanceof Error ? error.message : "unknown_error",
    });
    throw error;
  }
}

export async function handleOrderCreateWebhook(
  input: OrderWebhookInput,
): Promise<OrderWebhookResult> {
  return handleOrderWebhook(input);
}

export async function handleOrderUpdatedWebhook(
  input: OrderWebhookInput,
): Promise<OrderWebhookResult> {
  return handleOrderWebhook(input);
}

export async function handleOrderCancelledWebhook(
  input: OrderWebhookInput,
): Promise<OrderWebhookResult> {
  return handleOrderWebhook(input);
}

export const ORDERS_QUERY = `#graphql
  query StorePilotGetOrders($first: Int!, $cursor: String, $query: String) {
    orders(
      first: $first
      after: $cursor
      sortKey: PROCESSED_AT
      reverse: true
      query: $query
    ) {
      edges {
        node {
          id
          name
          createdAt
          updatedAt
          processedAt
          cancelledAt
          displayFinancialStatus
          currencyCode
          test
          currentSubtotalPriceSet {
            shopMoney {
              amount
            }
          }
          currentTotalTaxSet {
            shopMoney {
              amount
            }
          }
          currentTotalDiscountsSet {
            shopMoney {
              amount
            }
          }
          currentTotalPriceSet {
            shopMoney {
              amount
            }
          }
          lineItems(first: 250) {
            edges {
              node {
                id
                title
                sku
                quantity
                currentQuantity
                isGiftCard
                variant {
                  id
                }
                product {
                  id
                }
                originalUnitPriceSet {
                  shopMoney {
                    amount
                  }
                }
                discountedUnitPriceSet {
                  shopMoney {
                    amount
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
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const ORDER_LINE_ITEM_GRAPHQL_FIELDS = `
  id
  title
  sku
  quantity
  currentQuantity
  isGiftCard
  variant {
    id
  }
  product {
    id
  }
  originalUnitPriceSet {
    shopMoney {
      amount
    }
  }
  discountedUnitPriceSet {
    shopMoney {
      amount
    }
  }
`;

const ORDER_GRAPHQL_FIELDS = `
  id
  name
  createdAt
  updatedAt
  processedAt
  cancelledAt
  displayFinancialStatus
  currencyCode
  test
  currentSubtotalPriceSet {
    shopMoney {
      amount
    }
  }
  currentTotalTaxSet {
    shopMoney {
      amount
    }
  }
  currentTotalDiscountsSet {
    shopMoney {
      amount
    }
  }
  currentTotalPriceSet {
    shopMoney {
      amount
    }
  }
`;

export const ORDER_BY_ID_QUERY = `#graphql
  query StorePilotGetOrder($id: ID!) {
    order(id: $id) {
      ${ORDER_GRAPHQL_FIELDS}
      lineItems(first: 250) {
        edges {
          node {
            ${ORDER_LINE_ITEM_GRAPHQL_FIELDS}
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

const ORDER_LINE_ITEMS_QUERY = `#graphql
  query StorePilotGetOrderLineItems($id: ID!, $cursor: String) {
    order(id: $id) {
      id
      lineItems(first: 250, after: $cursor) {
        edges {
          node {
            ${ORDER_LINE_ITEM_GRAPHQL_FIELDS}
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

type OrdersSyncLogContext = {
  shop: string;
  storeId?: string;
  operation:
    | "orders_page"
    | "orders_sync_error"
    | "order_normalize_failed"
    | "order_upsert"
    | "order_line_item_upsert"
    | "order_reconcile_completed"
    | "order_reconcile_skipped"
    | "order_line_item_pages_loaded"
    | "orders_sync_started"
    | "orders_sync_completed"
    | "orders_sync_incomplete"
    | "orders_sync_summary"
    | "orders_sync_failed"
    | "orders_sync_blocked"
    | "orders_incremental_started"
    | "orders_incremental_page"
    | "orders_incremental_completed"
    | "orders_incremental_blocked"
    | "limit_exceeded"
    | "store_ineligible"
    | "stale_write_skipped";
  reason?: string;
  incomingUpdatedAt?: string;
  existingUpdatedAt?: string;
  shopifyOrderId?: string;
  shopifyLineItemId?: string;
  orderId?: string;
  created?: boolean;
  archivedCount?: number;
  blockedMessage?: string;
  orderCount?: number;
  orderPages?: number;
  ordersProcessed?: number;
  lineItemsProcessed?: number;
  upserted?: number;
  skipped?: number;
  durationMs?: number;
  normalizedLineItemCount?: number;
  shopifyLineItemCount?: number;
  lineItemCount?: number;
  lineItemPages?: number;
  cursor?: string | null;
  query?: string;
  hasNextPage?: boolean;
  quarantinedOrderIds?: string[];
};

interface GraphQlError {
  message?: string;
  extensions?: {
    code?: string;
  };
}

interface MoneyBag {
  shopMoney?: {
    amount?: string | null;
  } | null;
}

export interface OrdersPageInfo {
  hasNextPage?: boolean | null;
  endCursor?: string | null;
}

export interface OrderLineItemNode {
  id?: string | null;
  title?: string | null;
  sku?: string | null;
  quantity?: number | null;
  currentQuantity?: number | null;
  isGiftCard?: boolean | null;
  variant?: {
    id?: string | null;
  } | null;
  product?: {
    id?: string | null;
  } | null;
  originalUnitPriceSet?: MoneyBag | null;
  discountedUnitPriceSet?: MoneyBag | null;
}

export interface OrderNode {
  id?: string | null;
  name?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  processedAt?: string | null;
  cancelledAt?: string | null;
  displayFinancialStatus?: string | null;
  currencyCode?: string | null;
  test?: boolean | null;
  currentSubtotalPriceSet?: MoneyBag | null;
  currentTotalTaxSet?: MoneyBag | null;
  currentTotalDiscountsSet?: MoneyBag | null;
  currentTotalPriceSet?: MoneyBag | null;
  lineItems?: {
    edges?: Array<{ node?: OrderLineItemNode | null }> | null;
    pageInfo?: OrdersPageInfo | null;
  } | null;
}

export interface OrdersQueryResponse {
  data?: {
    orders?: {
      edges?: Array<{ node?: OrderNode | null }> | null;
      pageInfo?: OrdersPageInfo | null;
    } | null;
  };
  errors?: GraphQlError[];
}

export type FetchOrdersPageInput = {
  admin: StoreSyncAdminClient;
  shop: string;
  storeId?: string;
  cursor: string | null;
  query: string;
};

export type NormalizedOrderRow = {
  shopifyOrderId: string;
  orderName: string;
  shopifyCreatedAt: Date;
  shopifyUpdatedAt: Date;
  processedAt: Date;
  cancelledAt: Date | null;
  metricDate: Date;
  displayFinancialStatus: string | null;
  currencyCode: string;
  subtotalAmount: string;
  totalTaxAmount: string;
  totalDiscountAmount: string;
  totalPriceAmount: string;
  totalRefundedAmount: string;
  isTest: boolean;
  isPaid: boolean;
};

export type NormalizedOrderLineItemRow = {
  shopifyLineItemId: string;
  shopifyOrderId: string;
  shopifyProductId: string | null;
  shopifyVariantId: string | null;
  sku: string | null;
  title: string;
  quantity: number;
  originalUnitPrice: string;
  discountedUnitPrice: string;
  isGiftCard: boolean;
};

export type NormalizeOrderContext = {
  shop?: string;
  storeId?: string;
};

const DECIMAL_STRING_PATTERN = /^-?\d+(\.\d+)?$/;

function normalizeMoneyAmount(
  amount: string | null | undefined,
): string | null {
  if (amount == null) {
    return null;
  }

  const trimmed = amount.trim();
  if (!DECIMAL_STRING_PATTERN.test(trimmed)) {
    return null;
  }

  return trimmed;
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

function metricDateFromProcessedAt(processedAt: Date): Date {
  return new Date(
    Date.UTC(
      processedAt.getUTCFullYear(),
      processedAt.getUTCMonth(),
      processedAt.getUTCDate(),
    ),
  );
}

function logOrderNormalizeFailed(
  shopifyOrderId: string | undefined,
  reason: string,
  context?: NormalizeOrderContext,
): void {
  logOrdersSync("warn", "Order normalization failed", {
    shop: context?.shop ?? "",
    storeId: context?.storeId,
    operation: "order_normalize_failed",
    shopifyOrderId,
    reason,
  });
}

export function normalizeOrderRow(
  order: OrderNode,
  context?: NormalizeOrderContext,
): NormalizedOrderRow | null {
  const shopifyOrderId = order.id ?? undefined;

  if (!order.id) {
    logOrderNormalizeFailed(undefined, "missing_order_id", context);
    return null;
  }

  if (!order.processedAt) {
    logOrderNormalizeFailed(shopifyOrderId, "missing_processed_at", context);
    return null;
  }

  if (!order.currencyCode) {
    logOrderNormalizeFailed(shopifyOrderId, "missing_currency_code", context);
    return null;
  }

  if (!order.name) {
    logOrderNormalizeFailed(shopifyOrderId, "missing_order_name", context);
    return null;
  }

  const shopifyCreatedAt = parseIsoDateTime(order.createdAt);
  if (!shopifyCreatedAt) {
    logOrderNormalizeFailed(shopifyOrderId, "missing_created_at", context);
    return null;
  }

  const shopifyUpdatedAt = parseIsoDateTime(order.updatedAt);
  if (!shopifyUpdatedAt) {
    logOrderNormalizeFailed(shopifyOrderId, "missing_updated_at", context);
    return null;
  }

  const processedAt = parseIsoDateTime(order.processedAt);
  if (!processedAt) {
    logOrderNormalizeFailed(shopifyOrderId, "invalid_processed_at", context);
    return null;
  }

  const cancelledAt = order.cancelledAt
    ? parseIsoDateTime(order.cancelledAt)
    : null;
  if (order.cancelledAt && !cancelledAt) {
    logOrderNormalizeFailed(shopifyOrderId, "invalid_cancelled_at", context);
    return null;
  }

  const subtotalAmount = normalizeMoneyAmount(
    order.currentSubtotalPriceSet?.shopMoney?.amount,
  );
  if (!subtotalAmount) {
    logOrderNormalizeFailed(shopifyOrderId, "invalid_subtotal_amount", context);
    return null;
  }

  const totalTaxAmount = normalizeMoneyAmount(
    order.currentTotalTaxSet?.shopMoney?.amount,
  );
  if (!totalTaxAmount) {
    logOrderNormalizeFailed(shopifyOrderId, "invalid_total_tax_amount", context);
    return null;
  }

  const totalDiscountAmount = normalizeMoneyAmount(
    order.currentTotalDiscountsSet?.shopMoney?.amount,
  );
  if (!totalDiscountAmount) {
    logOrderNormalizeFailed(
      shopifyOrderId,
      "invalid_total_discount_amount",
      context,
    );
    return null;
  }

  const totalPriceAmount = normalizeMoneyAmount(
    order.currentTotalPriceSet?.shopMoney?.amount,
  );
  if (!totalPriceAmount) {
    logOrderNormalizeFailed(
      shopifyOrderId,
      "invalid_total_price_amount",
      context,
    );
    return null;
  }

  const displayFinancialStatus = order.displayFinancialStatus
    ? order.displayFinancialStatus.toLowerCase()
    : null;
  const isPaid = displayFinancialStatus === "paid";

  return {
    shopifyOrderId: order.id,
    orderName: order.name,
    shopifyCreatedAt,
    shopifyUpdatedAt,
    processedAt,
    cancelledAt,
    metricDate: metricDateFromProcessedAt(processedAt),
    displayFinancialStatus,
    currencyCode: order.currencyCode,
    subtotalAmount,
    totalTaxAmount,
    totalDiscountAmount,
    totalPriceAmount,
    totalRefundedAmount: "0",
    isTest: order.test ?? false,
    isPaid,
  };
}

export function normalizeOrderLineItemRow(
  order: OrderNode,
  lineItem: OrderLineItemNode,
): NormalizedOrderLineItemRow | null {
  if (!order.id || !lineItem.id || !lineItem.title) {
    return null;
  }

  const quantity = lineItem.currentQuantity ?? lineItem.quantity;
  if (quantity == null || !Number.isInteger(quantity)) {
    return null;
  }

  const originalUnitPrice = normalizeMoneyAmount(
    lineItem.originalUnitPriceSet?.shopMoney?.amount,
  );
  if (!originalUnitPrice) {
    return null;
  }

  const discountedUnitPrice = normalizeMoneyAmount(
    lineItem.discountedUnitPriceSet?.shopMoney?.amount,
  );
  if (!discountedUnitPrice) {
    return null;
  }

  return {
    shopifyLineItemId: lineItem.id,
    shopifyOrderId: order.id,
    shopifyProductId: lineItem.product?.id ?? null,
    shopifyVariantId: lineItem.variant?.id ?? null,
    sku: lineItem.sku?.trim() ? lineItem.sku : null,
    title: lineItem.title,
    quantity,
    originalUnitPrice,
    discountedUnitPrice,
    isGiftCard: lineItem.isGiftCard ?? false,
  };
}

export function logOrdersSync(
  level: LogLevel,
  message: string,
  context: OrdersSyncLogContext,
): void {
  const payload = { message, ...context };

  if (level === "error") {
    console.error("[order-sync]", payload);
    return;
  }

  if (level === "warn") {
    console.warn("[order-sync]", payload);
    return;
  }

  console.info("[order-sync]", payload);
}

export type UpsertOrderRowResult = {
  orderId: string | null;
  created: boolean;
  limitExceeded?: boolean;
  staleSkipped?: boolean;
};

export type UpsertOrderLineItemRowResult = {
  lineItemId: string;
  created: boolean;
};

export type ReconcileRemovedOrderLineItemsResult = {
  archivedCount: number;
};

export type UpsertOrderWithLineItemsResult = {
  orderId: string | null;
  created: boolean;
  lineItemsUpserted: number;
  archivedLineItems: number;
  limitExceeded?: boolean;
  staleSkipped?: boolean;
};

function orderRowToCreateData(storeId: string, row: NormalizedOrderRow) {
  return {
    storeId,
    shopifyOrderId: row.shopifyOrderId,
    orderName: row.orderName,
    shopifyCreatedAt: row.shopifyCreatedAt,
    shopifyUpdatedAt: row.shopifyUpdatedAt,
    processedAt: row.processedAt,
    cancelledAt: row.cancelledAt,
    metricDate: row.metricDate,
    displayFinancialStatus: row.displayFinancialStatus,
    currencyCode: row.currencyCode,
    subtotalAmount: new Prisma.Decimal(row.subtotalAmount),
    totalTaxAmount: new Prisma.Decimal(row.totalTaxAmount),
    totalDiscountAmount: new Prisma.Decimal(row.totalDiscountAmount),
    totalPriceAmount: new Prisma.Decimal(row.totalPriceAmount),
    totalRefundedAmount: new Prisma.Decimal(row.totalRefundedAmount),
    isTest: row.isTest,
    isPaid: row.isPaid,
  };
}

function orderRowToUpdateData(row: NormalizedOrderRow) {
  return {
    orderName: row.orderName,
    shopifyCreatedAt: row.shopifyCreatedAt,
    shopifyUpdatedAt: row.shopifyUpdatedAt,
    processedAt: row.processedAt,
    cancelledAt: row.cancelledAt,
    metricDate: row.metricDate,
    displayFinancialStatus: row.displayFinancialStatus,
    currencyCode: row.currencyCode,
    subtotalAmount: new Prisma.Decimal(row.subtotalAmount),
    totalTaxAmount: new Prisma.Decimal(row.totalTaxAmount),
    totalDiscountAmount: new Prisma.Decimal(row.totalDiscountAmount),
    totalPriceAmount: new Prisma.Decimal(row.totalPriceAmount),
    totalRefundedAmount: new Prisma.Decimal(row.totalRefundedAmount),
    isTest: row.isTest,
    isPaid: row.isPaid,
  };
}

function orderLineItemRowToCreateData(
  storeId: string,
  orderId: string,
  row: NormalizedOrderLineItemRow,
) {
  return {
    storeId,
    orderId,
    shopifyLineItemId: row.shopifyLineItemId,
    shopifyOrderId: row.shopifyOrderId,
    shopifyProductId: row.shopifyProductId,
    shopifyVariantId: row.shopifyVariantId,
    sku: row.sku,
    title: row.title,
    quantity: row.quantity,
    originalUnitPrice: new Prisma.Decimal(row.originalUnitPrice),
    discountedUnitPrice: new Prisma.Decimal(row.discountedUnitPrice),
    isGiftCard: row.isGiftCard,
  };
}

function orderLineItemRowToUpdateData(
  orderId: string,
  row: NormalizedOrderLineItemRow,
) {
  return {
    orderId,
    shopifyOrderId: row.shopifyOrderId,
    shopifyProductId: row.shopifyProductId,
    shopifyVariantId: row.shopifyVariantId,
    sku: row.sku,
    title: row.title,
    quantity: row.quantity,
    originalUnitPrice: new Prisma.Decimal(row.originalUnitPrice),
    discountedUnitPrice: new Prisma.Decimal(row.discountedUnitPrice),
    isGiftCard: row.isGiftCard,
  };
}

export async function upsertOrderRow(
  storeId: string,
  row: NormalizedOrderRow,
  db: OrdersDbClient = prisma,
): Promise<UpsertOrderRowResult> {
  const existing = await db.order.findUnique({
    where: {
      storeId_shopifyOrderId: {
        storeId,
        shopifyOrderId: row.shopifyOrderId,
      },
    },
    select: { id: true, shopifyUpdatedAt: true, privacyRedacted: true },
  });

  if (existing?.privacyRedacted) {
    logOrdersSync("info", "Order upsert skipped for privacy-redacted order", {
      shop: "",
      storeId,
      operation: "stale_write_skipped",
      shopifyOrderId: row.shopifyOrderId,
      reason: "privacy_redacted",
    });

    return {
      orderId: existing.id,
      created: false,
      staleSkipped: true,
    };
  }

  if (existing) {
    if (row.shopifyUpdatedAt <= existing.shopifyUpdatedAt) {
      logOrdersSync("info", "Order update skipped due to stale Shopify timestamp", {
        shop: "",
        storeId,
        operation: "stale_write_skipped",
        shopifyOrderId: row.shopifyOrderId,
        incomingUpdatedAt: row.shopifyUpdatedAt.toISOString(),
        existingUpdatedAt: existing.shopifyUpdatedAt.toISOString(),
      });

      return {
        orderId: existing.id,
        created: false,
        staleSkipped: true,
      };
    }

    const updated = await db.order.updateMany({
      where: {
        storeId,
        shopifyOrderId: row.shopifyOrderId,
        shopifyUpdatedAt: { lt: row.shopifyUpdatedAt },
      },
      data: orderRowToUpdateData(row),
    });

    if (updated.count === 0) {
      logOrdersSync("info", "Order update skipped due to stale Shopify timestamp", {
        shop: "",
        storeId,
        operation: "stale_write_skipped",
        shopifyOrderId: row.shopifyOrderId,
        incomingUpdatedAt: row.shopifyUpdatedAt.toISOString(),
        existingUpdatedAt: existing.shopifyUpdatedAt.toISOString(),
      });

      return {
        orderId: existing.id,
        created: false,
        staleSkipped: true,
      };
    }

    logOrdersSync("info", "Order upserted", {
      shop: "",
      storeId,
      operation: "order_upsert",
      shopifyOrderId: row.shopifyOrderId,
      created: false,
    });

    return {
      orderId: existing.id,
      created: false,
    };
  }

  return runOrderCreateWithAtomicLimit(db, async (client) => {
    const limitCheck = await assertOrderCreateAllowedAtomic(client, storeId);
    if (!limitCheck.allowed) {
      logOrdersSync("warn", "Order create blocked by plan limit", {
        shop: "",
        storeId,
        operation: "limit_exceeded",
        reason: limitCheck.reason ?? BILLING_LIMIT_EXCEEDED,
        shopifyOrderId: row.shopifyOrderId,
      });

      return {
        orderId: null,
        created: false,
        limitExceeded: true,
      };
    }

    const created = await client.order.create({
      data: orderRowToCreateData(storeId, row),
      select: { id: true },
    });

    logOrdersSync("info", "Order upserted", {
      shop: "",
      storeId,
      operation: "order_upsert",
      shopifyOrderId: row.shopifyOrderId,
      created: true,
    });

    return {
      orderId: created.id,
      created: true,
    };
  });
}

export async function upsertOrderLineItemRow(
  storeId: string,
  orderId: string,
  row: NormalizedOrderLineItemRow,
  db: OrdersDbClient = prisma,
): Promise<UpsertOrderLineItemRowResult> {
  const existing = await db.orderLineItem.findUnique({
    where: {
      storeId_shopifyLineItemId: {
        storeId,
        shopifyLineItemId: row.shopifyLineItemId,
      },
    },
    select: { id: true },
  });

  if (existing) {
    await db.orderLineItem.update({
      where: {
        storeId_shopifyLineItemId: {
          storeId,
          shopifyLineItemId: row.shopifyLineItemId,
        },
      },
      data: orderLineItemRowToUpdateData(orderId, row),
    });

    logOrdersSync("info", "Order line item upserted", {
      shop: "",
      storeId,
      operation: "order_line_item_upsert",
      shopifyLineItemId: row.shopifyLineItemId,
      created: false,
    });

    return {
      lineItemId: existing.id,
      created: false,
    };
  }

  const created = await db.orderLineItem.create({
    data: orderLineItemRowToCreateData(storeId, orderId, row),
    select: { id: true },
  });

  logOrdersSync("info", "Order line item upserted", {
    shop: "",
    storeId,
    operation: "order_line_item_upsert",
    shopifyLineItemId: row.shopifyLineItemId,
    created: true,
  });

  return {
    lineItemId: created.id,
    created: true,
  };
}

export async function reconcileRemovedOrderLineItems(
  storeId: string,
  orderId: string,
  activeShopifyLineItemIds: string[],
  db: OrdersDbClient = prisma,
): Promise<ReconcileRemovedOrderLineItemsResult> {
  const result = await db.orderLineItem.deleteMany({
    where: {
      storeId,
      orderId,
      shopifyLineItemId: { notIn: activeShopifyLineItemIds },
    },
  });

  return {
    archivedCount: result.count,
  };
}

export async function upsertOrderWithLineItems(
  storeId: string,
  normalizedOrder: NormalizedOrderRow,
  normalizedLineItems: NormalizedOrderLineItemRow[],
  db: OrdersDbClient = prisma,
  reconcile = true,
  shopifyLineItemCount?: number,
): Promise<UpsertOrderWithLineItemsResult> {
  const { orderId, created, limitExceeded, staleSkipped } = await upsertOrderRow(
    storeId,
    normalizedOrder,
    db,
  );

  if (limitExceeded || !orderId) {
    return {
      orderId: null,
      created: false,
      lineItemsUpserted: 0,
      archivedLineItems: 0,
      limitExceeded: true,
    };
  }

  if (staleSkipped) {
    return {
      orderId,
      created: false,
      lineItemsUpserted: 0,
      archivedLineItems: 0,
      staleSkipped: true,
    };
  }

  let lineItemsUpserted = 0;
  for (const lineItem of normalizedLineItems) {
    await upsertOrderLineItemRow(storeId, orderId, lineItem, db);
    lineItemsUpserted += 1;
  }

  if (normalizedLineItems.length === 0) {
    logOrdersSync("warn", "Order line item reconcile skipped", {
      shop: "",
      storeId,
      operation: "order_reconcile_skipped",
      orderId,
      reason: "empty_line_item_set",
    });

    return {
      orderId,
      created,
      lineItemsUpserted,
      archivedLineItems: 0,
    };
  }

  if (!reconcile) {
    logOrdersSync("warn", "Order line item reconcile skipped", {
      shop: "",
      storeId,
      operation: "order_reconcile_skipped",
      orderId,
      reason: "incomplete_line_item_set",
      normalizedLineItemCount: normalizedLineItems.length,
      shopifyLineItemCount,
    });

    return {
      orderId,
      created,
      lineItemsUpserted,
      archivedLineItems: 0,
    };
  }

  const activeShopifyLineItemIds = normalizedLineItems.map(
    (lineItem) => lineItem.shopifyLineItemId,
  );
  const { archivedCount } = await reconcileRemovedOrderLineItems(
    storeId,
    orderId,
    activeShopifyLineItemIds,
    db,
  );

  logOrdersSync("info", "Order line item reconcile completed", {
    shop: "",
    storeId,
    operation: "order_reconcile_completed",
    orderId,
    archivedCount,
  });

  return {
    orderId,
    created,
    lineItemsUpserted,
    archivedLineItems: archivedCount,
  };
}

function handleOrdersGraphqlErrors(
  body: { errors?: GraphQlError[] },
  shop: string,
  storeId?: string,
): void {
  if (!body.errors?.length) {
    return;
  }

  const reason = body.errors
    .map((error) => error.message ?? "unknown")
    .join("; ");

  logOrdersSync("error", "GraphQL returned errors", {
    shop,
    storeId,
    operation: "orders_sync_error",
    reason,
  });

  const blocked = classifyPermanentOrdersAccessFailure(reason, body.errors);
  if (blocked) {
    throw new Error(blocked.blockedReason);
  }

  throw new Error("graphql_errors");
}

export type OrdersAccessBlockedReason =
  | "insufficient_scope"
  | "access_denied"
  | "protected_customer_data";

export function classifyPermanentOrdersAccessFailure(
  reason: string,
  errors?: GraphQlError[],
): {
  blockedReason: OrdersAccessBlockedReason;
  blockedMessage: string;
} | null {
  const normalizedReason = reason.toLowerCase();

  const hasAccessDeniedCode = errors?.some(
    (error) =>
      error.extensions?.code === "ACCESS_DENIED" ||
      String(error.extensions?.code ?? "").toLowerCase() === "access_denied",
  );

  if (
    normalizedReason.includes("insufficient_scope") ||
    normalizedReason.includes("missing access scope") ||
    normalizedReason.includes("read_orders")
  ) {
    return {
      blockedReason: "insufficient_scope",
      blockedMessage: reason,
    };
  }

  if (
    hasAccessDeniedCode ||
    normalizedReason.includes("access denied") ||
    normalizedReason.includes("access_denied")
  ) {
    return {
      blockedReason: "access_denied",
      blockedMessage: reason,
    };
  }

  if (
    normalizedReason.includes("protected_customer_data") ||
    normalizedReason.includes("protected customer data") ||
    normalizedReason.includes("pcd") ||
    normalizedReason.includes("customer data")
  ) {
    return {
      blockedReason: "protected_customer_data",
      blockedMessage: reason,
    };
  }

  return null;
}

function buildBlockedOrdersSyncResult(
  result: SyncOrdersResult,
  blockedReason: OrdersAccessBlockedReason,
  blockedMessage: string,
): SyncOrdersResult {
  return {
    ...result,
    success: false,
    blocked: true,
    blockedReason,
    blockedMessage,
  };
}

function handleOrdersSyncCatch(
  error: unknown,
  result: SyncOrdersResult,
  context: {
    shop: string;
    storeId: string;
    startedAt: number;
    blockedOperation: "orders_sync_blocked" | "orders_incremental_blocked";
    failedOperation: "orders_sync_failed";
    failedMessage?: string;
  },
): SyncOrdersResult {
  const blocked = classifyPermanentOrdersAccessFailure(
    error instanceof Error ? error.message : String(error),
  );

  if (blocked) {
    logOrdersSync("warn", "Orders sync blocked by permanent access failure", {
      shop: context.shop,
      storeId: context.storeId,
      operation: context.blockedOperation,
      reason: blocked.blockedReason,
      blockedMessage: blocked.blockedMessage,
      orderPages: result.orderPages,
      ordersProcessed: result.ordersProcessed,
      lineItemsProcessed: result.lineItemsProcessed,
      upserted: result.upserted,
      skipped: result.skipped,
      durationMs: Date.now() - context.startedAt,
    });

    return buildBlockedOrdersSyncResult(
      result,
      blocked.blockedReason,
      blocked.blockedMessage,
    );
  }

  logOrdersSync("error", context.failedMessage ?? "Orders sync failed", {
    shop: context.shop,
    storeId: context.storeId,
    operation: context.failedOperation,
    reason: error instanceof Error ? error.message : "unknown_error",
    orderPages: result.orderPages,
    ordersProcessed: result.ordersProcessed,
    lineItemsProcessed: result.lineItemsProcessed,
    upserted: result.upserted,
    skipped: result.skipped,
    durationMs: Date.now() - context.startedAt,
  });

  return result;
}

export async function fetchOrdersPage({
  admin,
  shop,
  storeId,
  cursor,
  query,
}: FetchOrdersPageInput): Promise<OrdersQueryResponse> {
  const response = await graphqlWithRetry(
    admin,
    ORDERS_QUERY,
    {
      first: ORDERS_PAGE_SIZE,
      cursor,
      query,
    },
    { shop, storeId },
  );
  const body = (await response.json()) as OrdersQueryResponse;

  handleOrdersGraphqlErrors(body, shop, storeId);

  return body;
}

function buildHistoricalOrdersQuery(referenceDate: Date = new Date()): string {
  const cutoff = new Date(referenceDate);
  cutoff.setUTCDate(cutoff.getUTCDate() - HISTORICAL_ORDERS_DAYS);
  const isoDate = cutoff.toISOString().slice(0, 10);

  return `processed_at:>=${isoDate}`;
}

export function buildIncrementalOrdersQuery(
  cursor: string | null,
  lastOrdersSyncAt: Date | null,
  referenceDate: Date = new Date(),
): string {
  void cursor;

  if (lastOrdersSyncAt) {
    return `updated_at:>=${lastOrdersSyncAt.toISOString()}`;
  }

  return buildHistoricalOrdersQuery(referenceDate);
}

async function assertStoreEligibleForOrdersSync(
  storeId: string,
  shop: string,
): Promise<boolean> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { id: true, active: true, shopifyDomain: true },
  });

  if (!store || !store.active || store.shopifyDomain !== shop) {
    logOrdersSync("error", "Store is not eligible for orders sync", {
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

function collectNormalizedOrderLineItems(
  order: OrderNode,
): NormalizedOrderLineItemRow[] {
  const normalizedLineItems: NormalizedOrderLineItemRow[] = [];

  for (const edge of order.lineItems?.edges ?? []) {
    const lineItem = edge?.node;
    if (!lineItem) {
      continue;
    }

    const row = normalizeOrderLineItemRow(order, lineItem);
    if (row) {
      normalizedLineItems.push(row);
    }
  }

  return normalizedLineItems;
}

async function upsertSyncedOrder(
  order: OrderNode,
  storeId: string,
  shop: string,
  admin: OrderSyncAdminClient,
  result: SyncOrdersResult,
): Promise<"upserted" | "skipped" | "limit_blocked"> {
  const lineItemsComplete = await ensureCompleteOrderLineItems(
    admin,
    shop,
    storeId,
    order,
  );
  if (!lineItemsComplete) {
    recordSkippedOrder(result, order.id);
    return "skipped";
  }

  result.ordersProcessed += 1;

  const normalizedOrder = normalizeOrderRow(order, { shop, storeId });
  if (!normalizedOrder) {
    recordSkippedOrder(result, order.id);
    return "skipped";
  }

  const shopifyLineItemCount = countShopifyOrderLineItemNodes(order);
  const normalizedLineItems = collectNormalizedOrderLineItems(order);

  if (normalizedLineItems.length < shopifyLineItemCount) {
    recordSkippedOrder(result, order.id);
    return "skipped";
  }

  const reconcileSafe =
    normalizedLineItems.length > 0 &&
    normalizedLineItems.length === shopifyLineItemCount;

  result.lineItemsProcessed += normalizedLineItems.length;

  const upsertResult = await prisma.$transaction(async (tx) =>
    upsertOrderWithLineItems(
      storeId,
      normalizedOrder,
      normalizedLineItems,
      tx,
      reconcileSafe,
      shopifyLineItemCount,
    ),
  );

  if (upsertResult.limitExceeded) {
    recordSkippedOrder(result, order.id);
    const limitCheck = await checkOrderCreateAllowed(storeId);
    const blockedState = toBillingLimitBlockedState("orders", limitCheck);
    result.blocked = blockedState.blocked;
    result.blockedReason = blockedState.blockedReason;
    result.blockedMessage = blockedState.blockedMessage;

    logOrdersSync("warn", "Orders sync blocked by plan limit", {
      shop,
      storeId,
      operation: "limit_exceeded",
      reason: BILLING_LIMIT_EXCEEDED,
      skipped: result.skipped,
      upserted: result.upserted,
    });

    return "limit_blocked";
  }

  if (upsertResult.staleSkipped) {
    recordSkippedOrder(result, order.id);
    return "skipped";
  }

  result.upserted += 1;
  return "upserted";
}

async function retryQuarantinedOrders(
  quarantinedOrderIds: string[],
  storeId: string,
  shop: string,
  admin: OrderSyncAdminClient,
  result: SyncOrdersResult,
): Promise<string[]> {
  const stillQuarantined: string[] = [];

  for (const shopifyOrderId of quarantinedOrderIds) {
    try {
      const order = await fetchOrderById(admin, shop, storeId, shopifyOrderId);
      if (!order?.id) {
        stillQuarantined.push(shopifyOrderId);
        recordSkippedOrder(result, shopifyOrderId);
        continue;
      }

      const outcome = await upsertSyncedOrder(order, storeId, shop, admin, result);
      if (outcome === "limit_blocked") {
        const currentIndex = quarantinedOrderIds.indexOf(shopifyOrderId);
        return [
          ...stillQuarantined,
          shopifyOrderId,
          ...quarantinedOrderIds.slice(currentIndex + 1),
        ];
      }

      if (outcome === "skipped") {
        stillQuarantined.push(shopifyOrderId);
        continue;
      }

      if (result.skippedOrderIds) {
        result.skippedOrderIds = result.skippedOrderIds.filter(
          (id) => id !== shopifyOrderId,
        );
      }
    } catch {
      stillQuarantined.push(shopifyOrderId);
      recordSkippedOrder(result, shopifyOrderId);
    }
  }

  return stillQuarantined;
}

async function persistOrdersSyncCursorState(
  storeId: string,
  state: OrdersSyncCursorState,
): Promise<void> {
  await prisma.store.update({
    where: { id: storeId },
    data: { ordersSyncCursor: serializeOrdersSyncCursorState(state) },
  });
}

async function processOrdersPageEdges(
  edges: Array<{ node?: OrderNode | null } | null>,
  storeId: string,
  shop: string,
  admin: OrderSyncAdminClient,
  result: SyncOrdersResult,
): Promise<boolean> {
  for (const edge of edges) {
    const order = edge?.node;
    if (!order?.id) {
      recordSkippedOrder(result, order?.id);
      continue;
    }

    const outcome = await upsertSyncedOrder(order, storeId, shop, admin, result);
    if (outcome === "limit_blocked") {
      return true;
    }
  }

  return false;
}

export async function syncOrdersFromShopify(
  input: SyncOrdersInput,
): Promise<SyncOrdersResult> {
  const { storeId, shop, admin } = input;
  const startedAt = Date.now();
  const historicalQuery = buildHistoricalOrdersQuery();

  const result: SyncOrdersResult = {
    success: false,
    orderPages: 0,
    ordersProcessed: 0,
    lineItemsProcessed: 0,
    upserted: 0,
    skipped: 0,
  };

  if (!(await assertStoreEligibleForOrdersSync(storeId, shop))) {
    logOrdersSync("error", "Orders sync failed", {
      shop,
      storeId,
      operation: "orders_sync_failed",
      reason: "store_ineligible",
    });
    return result;
  }

  logOrdersSync("info", "Orders sync started", {
    shop,
    storeId,
    operation: "orders_sync_started",
    query: historicalQuery,
  });

  try {
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: {
        ordersSyncCursor: true,
        historicalOrdersImportDone: true,
      },
    });

    const syncState = parseOrdersSyncCursorState(store?.ordersSyncCursor);
    let orderCursor: string | null = syncState.pageCursor;
    let quarantinedOrderIds = [...syncState.quarantinedOrderIds];
    let historicalPagesComplete = syncState.historicalPagesComplete;
    let hasNextPage = !historicalPagesComplete;

    quarantinedOrderIds = await retryQuarantinedOrders(
      quarantinedOrderIds,
      storeId,
      shop,
      admin,
      result,
    );
    result.quarantinedOrderIds = [...quarantinedOrderIds];

    let billingLimitReached = false;

    while (hasNextPage && !billingLimitReached) {
      result.orderPages += 1;

      const body = await fetchOrdersPage({
        admin,
        shop,
        storeId,
        cursor: orderCursor,
        query: historicalQuery,
      });
      const orders = body.data?.orders;
      const edges = orders?.edges ?? [];
      const skippedBeforePage = result.skippedOrderIds?.length ?? 0;

      logOrdersSync("info", "Fetched orders page", {
        shop,
        storeId,
        operation: "orders_page",
        orderPages: result.orderPages,
        orderCount: edges.length,
        cursor: orderCursor,
        query: historicalQuery,
        hasNextPage: orders?.pageInfo?.hasNextPage === true,
      });

      billingLimitReached = await processOrdersPageEdges(
        edges,
        storeId,
        shop,
        admin,
        result,
      );

      const pageSkippedIds = (result.skippedOrderIds ?? []).slice(skippedBeforePage);
      quarantinedOrderIds = mergeQuarantinedOrderIds(
        quarantinedOrderIds,
        pageSkippedIds,
      );
      result.quarantinedOrderIds = [...quarantinedOrderIds];

      hasNextPage = orders?.pageInfo?.hasNextPage === true;
      const endCursor = orders?.pageInfo?.endCursor ?? null;

      if (hasNextPage && !billingLimitReached) {
        if (!endCursor) {
          throw new Error("missing_orders_page_cursor");
        }

        orderCursor = endCursor;
        await persistOrdersSyncCursorState(storeId, {
          pageCursor: endCursor,
          quarantinedOrderIds,
          historicalPagesComplete: false,
        });
      }
    }

    if (!hasNextPage) {
      historicalPagesComplete = true;
    }

    const importComplete =
      !result.blocked &&
      quarantinedOrderIds.length === 0 &&
      historicalPagesComplete;

    if (importComplete) {
      await prisma.store.update({
        where: { id: storeId },
        data: {
          historicalOrdersImportDone: true,
          lastOrdersSyncAt: new Date(),
          ordersSyncCursor: null,
        },
      });
    } else if (!result.blocked) {
      await persistOrdersSyncCursorState(storeId, {
        pageCursor: historicalPagesComplete ? null : orderCursor,
        quarantinedOrderIds,
        historicalPagesComplete,
      });

      if (quarantinedOrderIds.length > 0) {
        logOrdersSync("warn", "Historical orders import incomplete due to skipped orders", {
          shop,
          storeId,
          operation: "orders_sync_incomplete",
          reason: "skipped_orders_remain",
          skipped: result.skipped,
          upserted: result.upserted,
          ordersProcessed: result.ordersProcessed,
          quarantinedOrderIds,
        });
      }
    }

    result.success = importComplete;
    const durationMs = Date.now() - startedAt;

    logOrdersSync("info", "Orders sync completed", {
      shop,
      storeId,
      operation: "orders_sync_completed",
      orderPages: result.orderPages,
      ordersProcessed: result.ordersProcessed,
      lineItemsProcessed: result.lineItemsProcessed,
      upserted: result.upserted,
      skipped: result.skipped,
      durationMs,
    });

    logOrdersSync("info", "Orders sync summary", {
      shop,
      storeId,
      operation: "orders_sync_summary",
      orderPages: result.orderPages,
      ordersProcessed: result.ordersProcessed,
      lineItemsProcessed: result.lineItemsProcessed,
      upserted: result.upserted,
      skipped: result.skipped,
      durationMs,
    });

    return result;
  } catch (error) {
    return handleOrdersSyncCatch(error, result, {
      shop,
      storeId,
      startedAt,
      blockedOperation: "orders_sync_blocked",
      failedOperation: "orders_sync_failed",
    });
  }
}

export async function syncOrdersIncremental(
  input: SyncOrdersInput,
): Promise<SyncOrdersResult> {
  const { storeId, shop, admin } = input;
  const startedAt = Date.now();

  const result: SyncOrdersResult = {
    success: false,
    orderPages: 0,
    ordersProcessed: 0,
    lineItemsProcessed: 0,
    upserted: 0,
    skipped: 0,
  };

  if (!(await assertStoreEligibleForOrdersSync(storeId, shop))) {
    logOrdersSync("error", "Orders incremental sync failed", {
      shop,
      storeId,
      operation: "orders_sync_failed",
      reason: "store_ineligible",
    });
    return result;
  }

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: {
      lastOrdersSyncAt: true,
      ordersSyncCursor: true,
      active: true,
      shopifyDomain: true,
    },
  });

  if (!store || !store.active || store.shopifyDomain !== shop) {
    logOrdersSync("error", "Store is not eligible for orders sync", {
      shop,
      storeId,
      operation: "store_ineligible",
      reason: "store_not_found",
    });
    return result;
  }

  const incrementalQuery = buildIncrementalOrdersQuery(
    store.ordersSyncCursor,
    store.lastOrdersSyncAt,
  );

  logOrdersSync("info", "Orders incremental sync started", {
    shop,
    storeId,
    operation: "orders_incremental_started",
    query: incrementalQuery,
    cursor: store.ordersSyncCursor,
  });

  try {
    const syncState = parseOrdersSyncCursorState(store.ordersSyncCursor);
    let orderCursor: string | null = syncState.pageCursor;
    let quarantinedOrderIds = [...syncState.quarantinedOrderIds];
    let hasNextPage = true;

    quarantinedOrderIds = await retryQuarantinedOrders(
      quarantinedOrderIds,
      storeId,
      shop,
      admin,
      result,
    );
    result.quarantinedOrderIds = [...quarantinedOrderIds];

    let billingLimitReached = false;

    while (hasNextPage && !billingLimitReached) {
      result.orderPages += 1;

      const body = await fetchOrdersPage({
        admin,
        shop,
        storeId,
        cursor: orderCursor,
        query: incrementalQuery,
      });
      const orders = body.data?.orders;
      const edges = orders?.edges ?? [];
      const skippedBeforePage = result.skippedOrderIds?.length ?? 0;

      logOrdersSync("info", "Fetched incremental orders page", {
        shop,
        storeId,
        operation: "orders_incremental_page",
        orderPages: result.orderPages,
        orderCount: edges.length,
        cursor: orderCursor,
        query: incrementalQuery,
        hasNextPage: orders?.pageInfo?.hasNextPage === true,
      });

      billingLimitReached = await processOrdersPageEdges(
        edges,
        storeId,
        shop,
        admin,
        result,
      );

      const pageSkippedIds = (result.skippedOrderIds ?? []).slice(skippedBeforePage);
      quarantinedOrderIds = mergeQuarantinedOrderIds(
        quarantinedOrderIds,
        pageSkippedIds,
      );
      result.quarantinedOrderIds = [...quarantinedOrderIds];

      hasNextPage = orders?.pageInfo?.hasNextPage === true;
      const endCursor = orders?.pageInfo?.endCursor ?? null;

      if (hasNextPage && !billingLimitReached) {
        if (!endCursor) {
          throw new Error("missing_orders_page_cursor");
        }

        orderCursor = endCursor;
        await persistOrdersSyncCursorState(storeId, {
          pageCursor: endCursor,
          quarantinedOrderIds,
          historicalPagesComplete: false,
        });
      }
    }

    const incrementalComplete = !result.blocked && quarantinedOrderIds.length === 0;

    if (incrementalComplete) {
      await prisma.store.update({
        where: { id: storeId },
        data: {
          ordersSyncCursor: null,
          lastOrdersSyncAt: new Date(),
        },
      });
    } else if (!result.blocked) {
      await persistOrdersSyncCursorState(storeId, {
        pageCursor: null,
        quarantinedOrderIds,
        historicalPagesComplete: true,
      });

      if (quarantinedOrderIds.length > 0) {
        logOrdersSync("warn", "Incremental orders sync incomplete due to skipped orders", {
          shop,
          storeId,
          operation: "orders_sync_incomplete",
          reason: "skipped_orders_remain",
          skipped: result.skipped,
          upserted: result.upserted,
          ordersProcessed: result.ordersProcessed,
          quarantinedOrderIds,
        });
      }
    }

    result.success = incrementalComplete;
    const durationMs = Date.now() - startedAt;

    logOrdersSync("info", "Orders incremental sync completed", {
      shop,
      storeId,
      operation: "orders_incremental_completed",
      orderPages: result.orderPages,
      ordersProcessed: result.ordersProcessed,
      lineItemsProcessed: result.lineItemsProcessed,
      upserted: result.upserted,
      skipped: result.skipped,
      durationMs,
    });

    return result;
  } catch (error) {
    return handleOrdersSyncCatch(error, result, {
      shop,
      storeId,
      startedAt,
      blockedOperation: "orders_incremental_blocked",
      failedOperation: "orders_sync_failed",
      failedMessage: "Orders incremental sync failed",
    });
  }
}
