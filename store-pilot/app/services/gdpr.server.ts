import prisma from "../db.server";
import { sanitizeLogContext } from "../lib/privacy-by-architecture";
import {
  claimWebhookEvent,
  finalizeWebhookClaim,
  isClaimDuplicate,
  isClaimRetryable,
} from "./webhook.server";
import { Prisma } from "@prisma/client";

type LogLevel = "info" | "error";

export const REDACTED_ORDER_NAME = "[redacted]";

export type GDPRWebhookInput = {
  shop: string;
  topic: string;
  webhookId: string;
  payload: Record<string, unknown>;
};

export type CustomerDataExportOrder = {
  shopifyOrderId: string;
  orderName: string;
  shopifyCreatedAt: string;
  shopifyUpdatedAt: string;
  currencyCode: string;
  totalPriceAmount: string;
  isPaid: boolean;
  isTest: boolean;
};

export type CustomerDataExportLineItem = {
  shopifyOrderId: string;
  shopifyLineItemId: string;
  title: string;
  sku: string | null;
  quantity: number;
};

export type CustomerDataExportWebhookEvent = {
  id: string;
  topic: string;
  processedAt: string;
};

export type CustomerDataExport = {
  shopifyCustomerId: string;
  storeId: string | null;
  dataRequestId: string | null;
  storedCustomerProfile: {
    email: false;
    phone: false;
    name: false;
    note: string;
  };
  orders: CustomerDataExportOrder[];
  orderLineItems: CustomerDataExportLineItem[];
  webhookEvents: {
    note: string;
    records: CustomerDataExportWebhookEvent[];
  };
};

export type CustomerRedactSummary = {
  shopifyCustomerId: string;
  storeId: string | null;
  ordersRequested: number;
  ordersRedacted: number;
  lineItemsRedacted: number;
  exportsRemoved: number;
  alreadyRedacted: boolean;
};

export type CustomerRedactionResult = CustomerRedactSummary;

export type GDPRWebhookResult = {
  success: boolean;
  action:
    | "customer_data_exported"
    | "customer_redacted"
    | "shop_redacted"
    | "store_not_found";
  skipped?: boolean;
  shopifyCustomerId?: string;
  storeId?: string;
  exportReference?: string;
  exportDeliveryPath?: string;
  export?: CustomerDataExport;
  redact?: CustomerRedactSummary;
};

type GdprLogOperation =
  | "gdpr_data_request_received"
  | "customer_data_request_processed"
  | "customer_data_export_persisted"
  | "customer_data_export_delivery_ready"
  | "gdpr_customer_redact_received"
  | "customer_redacted"
  | "gdpr_shop_redact_received"
  | "gdpr_shop_redact_processed"
  | "gdpr_webhook_failed"
  | "shop_redacted";

type GdprLogContext = {
  shop: string;
  topic: string;
  webhookId: string;
  operation: GdprLogOperation;
  shopifyCustomerId?: string;
  storeId?: string;
  action?: string;
  reason?: string;
  orderCount?: number;
  lineItemCount?: number;
  exportReference?: string;
  exportDeliveryPath?: string;
  ordersRedacted?: number;
  alreadyRedacted?: boolean;
};

function logGdprWebhook(
  level: LogLevel,
  message: string,
  context: GdprLogContext,
): void {
  const payload = sanitizeLogContext({ message, ...context });

  if (level === "error") {
    console.error("[gdpr-webhook]", payload);
    return;
  }

  console.info("[gdpr-webhook]", payload);
}

async function resolveStoreForGdprWebhook(
  shop: string,
): Promise<{ storeId: string } | null> {
  const store = await prisma.store.findUnique({
    where: { shopifyDomain: shop },
    select: { id: true },
  });

  if (!store) {
    return null;
  }

  return { storeId: store.id };
}

function extractShopifyCustomerId(payload: Record<string, unknown>): string {
  const customer = payload.customer;

  if (!customer || typeof customer !== "object") {
    throw new Error("missing_customer");
  }

  const customerId = (customer as Record<string, unknown>).id;

  if (customerId === undefined || customerId === null || customerId === "") {
    throw new Error("missing_customer_id");
  }

  return String(customerId);
}

function extractDataRequestId(payload: Record<string, unknown>): string | null {
  const dataRequest = payload.data_request;

  if (!dataRequest || typeof dataRequest !== "object") {
    return null;
  }

  const id = (dataRequest as Record<string, unknown>).id;
  if (id === undefined || id === null || id === "") {
    return null;
  }

  return String(id);
}

function toShopifyOrderGid(value: unknown): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const normalized = String(value);
  if (normalized.startsWith("gid://shopify/Order/")) {
    return normalized;
  }

  return `gid://shopify/Order/${normalized}`;
}

function extractShopifyOrderGids(
  payload: Record<string, unknown>,
  field: "orders_requested" | "orders_to_redact",
): string[] {
  const raw = payload[field];
  if (!Array.isArray(raw)) {
    return [];
  }

  const gids: string[] = [];
  for (const value of raw) {
    const gid = toShopifyOrderGid(value);
    if (gid) {
      gids.push(gid);
    }
  }

  return gids;
}

export class CustomerDataExportScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomerDataExportScopeError";
  }
}

export function validateCustomerDataExportScope(
  exportPayload: CustomerDataExport,
  requestedOrderGids: string[],
): void {
  const allowedOrders = new Set(requestedOrderGids);

  for (const order of exportPayload.orders) {
    if (!allowedOrders.has(order.shopifyOrderId)) {
      throw new CustomerDataExportScopeError("export_order_out_of_scope");
    }
  }

  for (const lineItem of exportPayload.orderLineItems) {
    if (!allowedOrders.has(lineItem.shopifyOrderId)) {
      throw new CustomerDataExportScopeError("export_line_item_out_of_scope");
    }
  }

  if (exportPayload.webhookEvents.records.length > 0) {
    throw new CustomerDataExportScopeError("export_webhook_metadata_forbidden");
  }
}

function validateShopRedactPayload(payload: Record<string, unknown>): void {
  const shopDomain = payload.shop_domain;

  if (typeof shopDomain !== "string" || shopDomain.length === 0) {
    throw new Error("missing_shop_domain");
  }
}

async function deleteShopSessions(shop: string): Promise<void> {
  await prisma.session.deleteMany({ where: { shop } });
}

async function deleteShopDataByDomain(
  shop: string,
): Promise<{ storeId: string } | null> {
  const existing = await prisma.store.findUnique({
    where: { shopifyDomain: shop },
    select: { id: true },
  });

  if (!existing) {
    return null;
  }

  const storeId = existing.id;

  await prisma.$transaction(async (tx) => {
    await tx.storeOnboarding.deleteMany({ where: { storeId } });
    await tx.jobEvent.deleteMany({ where: { storeId } });
    await tx.syncJob.deleteMany({ where: { storeId } });
    await tx.orderLineItem.deleteMany({ where: { storeId } });
    await tx.order.deleteMany({ where: { storeId } });
    await tx.product.deleteMany({ where: { storeId } });
    await tx.webhookEvent.deleteMany({ where: { storeId } });
    await tx.usageRecord.deleteMany({ where: { storeId } });
    await tx.subscription.deleteMany({ where: { storeId } });
    await tx.user.deleteMany({ where: { storeId } });
    await tx.store.delete({ where: { id: storeId } });
  });

  await deleteShopSessions(shop);

  return { storeId };
}

export async function gatherCustomerDataExport(input: {
  storeId: string;
  shopifyCustomerId: string;
  dataRequestId: string | null;
  orderGids: string[];
}): Promise<CustomerDataExport> {
  const orders =
    input.orderGids.length > 0
      ? await prisma.order.findMany({
          where: {
            storeId: input.storeId,
            shopifyOrderId: { in: input.orderGids },
          },
          select: {
            shopifyOrderId: true,
            orderName: true,
            shopifyCreatedAt: true,
            shopifyUpdatedAt: true,
            currencyCode: true,
            totalPriceAmount: true,
            isPaid: true,
            isTest: true,
          },
        })
      : [];

  const orderGidsFound = orders.map((order) => order.shopifyOrderId);

  const lineItems =
    orderGidsFound.length > 0
      ? await prisma.orderLineItem.findMany({
          where: {
            storeId: input.storeId,
            shopifyOrderId: { in: orderGidsFound },
          },
          select: {
            shopifyOrderId: true,
            shopifyLineItemId: true,
            title: true,
            sku: true,
            quantity: true,
          },
        })
      : [];

  return {
    shopifyCustomerId: input.shopifyCustomerId,
    storeId: input.storeId,
    dataRequestId: input.dataRequestId,
    storedCustomerProfile: {
      email: false,
      phone: false,
      name: false,
      note:
        "StorePilot does not persist Shopify customer profile fields (email, phone, or name). Order aggregates are linked only by Shopify order IDs from the GDPR payload.",
    },
    orders: orders.map((order) => ({
      shopifyOrderId: order.shopifyOrderId,
      orderName: order.orderName,
      shopifyCreatedAt: order.shopifyCreatedAt.toISOString(),
      shopifyUpdatedAt: order.shopifyUpdatedAt.toISOString(),
      currencyCode: order.currencyCode,
      totalPriceAmount: order.totalPriceAmount.toString(),
      isPaid: order.isPaid,
      isTest: order.isTest,
    })),
    orderLineItems: lineItems.map((lineItem) => ({
      shopifyOrderId: lineItem.shopifyOrderId,
      shopifyLineItemId: lineItem.shopifyLineItemId,
      title: lineItem.title,
      sku: lineItem.sku,
      quantity: lineItem.quantity,
    })),
    webhookEvents: {
      note: "No webhook delivery metadata is included in customer exports.",
      records: [],
    },
  };
}

async function persistCustomerDataExport(input: {
  storeId: string;
  shopifyCustomerId: string;
  dataRequestId: string | null;
  shopifyWebhookId: string;
  exportPayload: CustomerDataExport;
}): Promise<string> {
  const record = await prisma.customerDataExport.create({
    data: {
      storeId: input.storeId,
      shopifyCustomerId: input.shopifyCustomerId,
      dataRequestId: input.dataRequestId,
      shopifyWebhookId: input.shopifyWebhookId,
      exportPayload: input.exportPayload as Prisma.InputJsonValue,
    },
  });

  return record.id;
}

async function loadCustomerDataExportByWebhookId(
  storeId: string,
  shopifyWebhookId: string,
): Promise<{
  id: string;
  shopifyCustomerId: string;
  exportPayload: CustomerDataExport;
} | null> {
  const record = await prisma.customerDataExport.findUnique({
    where: {
      storeId_shopifyWebhookId: {
        storeId,
        shopifyWebhookId,
      },
    },
    select: {
      id: true,
      shopifyCustomerId: true,
      exportPayload: true,
    },
  });

  if (!record) {
    return null;
  }

  return {
    id: record.id,
    shopifyCustomerId: record.shopifyCustomerId,
    exportPayload: record.exportPayload as CustomerDataExport,
  };
}

export async function getCustomerDataExportById(
  exportId: string,
): Promise<CustomerDataExport | null> {
  const record = await prisma.customerDataExport.findUnique({
    where: { id: exportId },
    select: { exportPayload: true },
  });

  if (!record) {
    return null;
  }

  return record.exportPayload as CustomerDataExport;
}

export function buildCustomerDataExportDeliveryPath(exportId: string): string {
  return `/app/compliance/customer-export/${exportId}`;
}

export async function getCustomerDataExportForStore(
  exportId: string,
  storeId: string,
): Promise<CustomerDataExport | null> {
  const record = await prisma.customerDataExport.findFirst({
    where: {
      id: exportId,
      storeId,
    },
    select: { exportPayload: true },
  });

  if (!record) {
    return null;
  }

  return record.exportPayload as CustomerDataExport;
}

const REDACTED_LINE_ITEM_TITLE = "[redacted]";
const REDACTED_FINANCIAL_AMOUNT = new Prisma.Decimal(0);

function isFinancialAmountRedacted(
  value: Prisma.Decimal | string | number,
): boolean {
  return new Prisma.Decimal(value).equals(REDACTED_FINANCIAL_AMOUNT);
}

function isOrderCustomerRedacted(order: {
  orderName: string;
  displayFinancialStatus: string | null;
  subtotalAmount: Prisma.Decimal;
  totalTaxAmount: Prisma.Decimal;
  totalDiscountAmount: Prisma.Decimal;
  totalPriceAmount: Prisma.Decimal;
  totalRefundedAmount: Prisma.Decimal;
}): boolean {
  return (
    order.orderName === REDACTED_ORDER_NAME &&
    order.displayFinancialStatus == null &&
    isFinancialAmountRedacted(order.subtotalAmount) &&
    isFinancialAmountRedacted(order.totalTaxAmount) &&
    isFinancialAmountRedacted(order.totalDiscountAmount) &&
    isFinancialAmountRedacted(order.totalPriceAmount) &&
    isFinancialAmountRedacted(order.totalRefundedAmount)
  );
}

export async function redactCustomerOrders(input: {
  storeId: string;
  shopifyCustomerId: string;
  orderGids: string[];
}): Promise<CustomerRedactionResult> {
  if (input.orderGids.length === 0) {
    const exportsRemoved = await prisma.customerDataExport.deleteMany({
      where: {
        storeId: input.storeId,
        shopifyCustomerId: input.shopifyCustomerId,
      },
    });

    return {
      shopifyCustomerId: input.shopifyCustomerId,
      storeId: input.storeId,
      ordersRequested: 0,
      ordersRedacted: 0,
      lineItemsRedacted: 0,
      exportsRemoved: exportsRemoved.count,
      alreadyRedacted: false,
    };
  }

  const orders = await prisma.order.findMany({
    where: {
      storeId: input.storeId,
      shopifyOrderId: { in: input.orderGids },
    },
    select: {
      id: true,
      shopifyOrderId: true,
      orderName: true,
      displayFinancialStatus: true,
      subtotalAmount: true,
      totalTaxAmount: true,
      totalDiscountAmount: true,
      totalPriceAmount: true,
      totalRefundedAmount: true,
    },
  });

  let ordersRedacted = 0;
  let lineItemsRedacted = 0;
  let alreadyRedacted = orders.length > 0;

  for (const order of orders) {
    if (!isOrderCustomerRedacted(order)) {
      alreadyRedacted = false;
      await prisma.order.update({
        where: { id: order.id },
        data: {
          orderName: REDACTED_ORDER_NAME,
          displayFinancialStatus: null,
          subtotalAmount: REDACTED_FINANCIAL_AMOUNT,
          totalTaxAmount: REDACTED_FINANCIAL_AMOUNT,
          totalDiscountAmount: REDACTED_FINANCIAL_AMOUNT,
          totalPriceAmount: REDACTED_FINANCIAL_AMOUNT,
          totalRefundedAmount: REDACTED_FINANCIAL_AMOUNT,
        },
      });
      ordersRedacted += 1;
    }

    const lineItemUpdate = await prisma.orderLineItem.updateMany({
      where: {
        storeId: input.storeId,
        shopifyOrderId: order.shopifyOrderId,
        OR: [
          { title: { not: REDACTED_LINE_ITEM_TITLE } },
          { sku: { not: null } },
          { originalUnitPrice: { not: REDACTED_FINANCIAL_AMOUNT } },
          { discountedUnitPrice: { not: REDACTED_FINANCIAL_AMOUNT } },
        ],
      },
      data: {
        title: REDACTED_LINE_ITEM_TITLE,
        sku: null,
        originalUnitPrice: REDACTED_FINANCIAL_AMOUNT,
        discountedUnitPrice: REDACTED_FINANCIAL_AMOUNT,
      },
    });

    lineItemsRedacted += lineItemUpdate.count;
  }

  const exportsRemoved = await prisma.customerDataExport.deleteMany({
    where: {
      storeId: input.storeId,
      shopifyCustomerId: input.shopifyCustomerId,
    },
  });

  return {
    shopifyCustomerId: input.shopifyCustomerId,
    storeId: input.storeId,
    ordersRequested: input.orderGids.length,
    ordersRedacted,
    lineItemsRedacted,
    exportsRemoved: exportsRemoved.count,
    alreadyRedacted: alreadyRedacted && ordersRedacted === 0 && lineItemsRedacted === 0,
  };
}

async function runWithGdprIdempotency(
  input: GDPRWebhookInput,
  storeId: string | undefined,
  process: () => Promise<GDPRWebhookResult>,
  failureOperation: GdprLogOperation,
  duplicateAction: GDPRWebhookResult["action"],
  onDuplicate?: (
    webhookInput: GDPRWebhookInput,
    resolvedStoreId: string,
  ) => Promise<GDPRWebhookResult | null>,
): Promise<GDPRWebhookResult> {
  if (!storeId) {
    return process();
  }

  const claim = await claimWebhookEvent({
    storeId,
    shop: input.shop,
    topic: input.topic,
    webhookId: input.webhookId,
  });

  if (isClaimDuplicate(claim)) {
    if (onDuplicate) {
      const loaded = await onDuplicate(input, storeId);
      if (loaded) {
        return loaded;
      }
    }

    return {
      success: true,
      action: duplicateAction,
      skipped: true,
    };
  }

  if (isClaimRetryable(claim)) {
    throw new Error(`retriable_webhook_claim:${claim.reason ?? claim.status}`);
  }

  try {
    const result = await process();
    await finalizeWebhookClaim(claim.eventId, true, claim.processingOwner);
    return result;
  } catch (error) {
    await finalizeWebhookClaim(claim.eventId, false, claim.processingOwner);

    logGdprWebhook("error", "GDPR webhook failed", {
      shop: input.shop,
      topic: input.topic,
      webhookId: input.webhookId,
      storeId,
      operation: failureOperation,
      reason: error instanceof Error ? error.message : "unknown_error",
    });
    throw error;
  }
}

export async function handleCustomersDataRequestWebhook(
  input: GDPRWebhookInput,
): Promise<GDPRWebhookResult> {
  logGdprWebhook("info", "Customer data request received", {
    shop: input.shop,
    topic: input.topic,
    webhookId: input.webhookId,
    operation: "gdpr_data_request_received",
  });

  const shopifyCustomerId = extractShopifyCustomerId(input.payload);
  const dataRequestId = extractDataRequestId(input.payload);
  const orderGids = extractShopifyOrderGids(input.payload, "orders_requested");
  const store = await resolveStoreForGdprWebhook(input.shop);

  const result = await runWithGdprIdempotency(
    input,
    store?.storeId,
    async () => {
      if (!store) {
        return {
          success: true,
          action: "customer_data_exported",
          shopifyCustomerId,
          export: {
            shopifyCustomerId,
            storeId: null,
            dataRequestId,
            storedCustomerProfile: {
              email: false,
              phone: false,
              name: false,
              note:
                "Store not found in StorePilot. No customer-specific records are stored for this shop.",
            },
            orders: [],
            orderLineItems: [],
            webhookEvents: {
              note: "No webhook records available because the store was not found.",
              records: [],
            },
          },
        };
      }

      const exportPayload = await gatherCustomerDataExport({
        storeId: store.storeId,
        shopifyCustomerId,
        dataRequestId,
        orderGids,
      });

      validateCustomerDataExportScope(exportPayload, orderGids);

      const exportReference = await persistCustomerDataExport({
        storeId: store.storeId,
        shopifyCustomerId,
        dataRequestId,
        shopifyWebhookId: input.webhookId,
        exportPayload,
      });

      logGdprWebhook("info", "Customer data export persisted", {
        shop: input.shop,
        topic: input.topic,
        webhookId: input.webhookId,
        shopifyCustomerId,
        storeId: store.storeId,
        operation: "customer_data_export_persisted",
        exportReference,
        orderCount: exportPayload.orders.length,
        lineItemCount: exportPayload.orderLineItems.length,
      });

      const exportDeliveryPath = buildCustomerDataExportDeliveryPath(exportReference);

      logGdprWebhook("info", "Customer data export ready for merchant delivery", {
        shop: input.shop,
        topic: input.topic,
        webhookId: input.webhookId,
        shopifyCustomerId,
        storeId: store.storeId,
        operation: "customer_data_export_delivery_ready",
        exportReference,
        exportDeliveryPath,
        orderCount: exportPayload.orders.length,
        lineItemCount: exportPayload.orderLineItems.length,
      });

      return {
        success: true,
        action: "customer_data_exported",
        shopifyCustomerId,
        storeId: store.storeId,
        exportReference,
        exportDeliveryPath,
        export: exportPayload,
      };
    },
    "gdpr_webhook_failed",
    "customer_data_exported",
    async (duplicateInput, resolvedStoreId) => {
      const persisted = await loadCustomerDataExportByWebhookId(
        resolvedStoreId,
        duplicateInput.webhookId,
      );

      if (!persisted) {
        return null;
      }

      return {
        success: true,
        action: "customer_data_exported",
        shopifyCustomerId: persisted.shopifyCustomerId,
        storeId: resolvedStoreId,
        exportReference: persisted.id,
        exportDeliveryPath: buildCustomerDataExportDeliveryPath(persisted.id),
        export: persisted.exportPayload,
        skipped: true,
      };
    },
  );

  logGdprWebhook("info", "Customer data request processed", {
    shop: input.shop,
    topic: input.topic,
    webhookId: input.webhookId,
    shopifyCustomerId,
    storeId: store?.storeId,
    operation: "customer_data_request_processed",
    action: result.action,
    exportReference: result.exportReference,
    exportDeliveryPath: result.exportDeliveryPath,
    orderCount: result.export?.orders.length ?? 0,
    lineItemCount: result.export?.orderLineItems.length ?? 0,
  });

  return result;
}

export async function handleCustomersRedactWebhook(
  input: GDPRWebhookInput,
): Promise<GDPRWebhookResult> {
  logGdprWebhook("info", "Customer redact received", {
    shop: input.shop,
    topic: input.topic,
    webhookId: input.webhookId,
    operation: "gdpr_customer_redact_received",
  });

  const shopifyCustomerId = extractShopifyCustomerId(input.payload);
  const orderGids = extractShopifyOrderGids(input.payload, "orders_to_redact");
  const store = await resolveStoreForGdprWebhook(input.shop);

  const result = await runWithGdprIdempotency(
    input,
    store?.storeId,
    async () => {
      if (!store) {
        return {
          success: true,
          action: "customer_redacted",
          shopifyCustomerId,
          redact: {
            shopifyCustomerId,
            storeId: null,
            ordersRequested: orderGids.length,
            ordersRedacted: 0,
            lineItemsRedacted: 0,
            exportsRemoved: 0,
            alreadyRedacted: false,
          },
        };
      }

      const redact = await redactCustomerOrders({
        storeId: store.storeId,
        shopifyCustomerId,
        orderGids,
      });

      return {
        success: true,
        action: "customer_redacted",
        shopifyCustomerId,
        storeId: store.storeId,
        redact,
      };
    },
    "gdpr_webhook_failed",
    "customer_redacted",
  );

  logGdprWebhook("info", "Customer redact completed", {
    shop: input.shop,
    topic: input.topic,
    webhookId: input.webhookId,
    shopifyCustomerId,
    storeId: store?.storeId,
    operation: "customer_redacted",
    action: result.action,
    ordersRedacted: result.redact?.ordersRedacted ?? 0,
    alreadyRedacted: result.redact?.alreadyRedacted ?? false,
  });

  return result;
}

export async function handleShopRedactWebhook(
  input: GDPRWebhookInput,
): Promise<GDPRWebhookResult> {
  logGdprWebhook("info", "Shop redact received", {
    shop: input.shop,
    topic: input.topic,
    webhookId: input.webhookId,
    operation: "gdpr_shop_redact_received",
  });

  validateShopRedactPayload(input.payload);
  const store = await resolveStoreForGdprWebhook(input.shop);

  if (!store) {
    await deleteShopSessions(input.shop);

    const result: GDPRWebhookResult = {
      success: true,
      action: "store_not_found",
    };

    logGdprWebhook("info", "Shop redact processed", {
      shop: input.shop,
      topic: input.topic,
      webhookId: input.webhookId,
      operation: "gdpr_shop_redact_processed",
      action: result.action,
    });

    return result;
  }

  const result = await runWithGdprIdempotency(
    input,
    store.storeId,
    async () => {
      const redacted = await deleteShopDataByDomain(input.shop);

      if (!redacted) {
        return {
          success: true,
          action: "store_not_found",
        };
      }

      logGdprWebhook("info", "Shop redacted", {
        shop: input.shop,
        topic: input.topic,
        webhookId: input.webhookId,
        storeId: redacted.storeId,
        operation: "shop_redacted",
        action: "shop_redacted",
      });

      return {
        success: true,
        action: "shop_redacted",
        storeId: redacted.storeId,
      };
    },
    "gdpr_webhook_failed",
    "shop_redacted",
  );

  logGdprWebhook("info", "Shop redact processed", {
    shop: input.shop,
    topic: input.topic,
    webhookId: input.webhookId,
    storeId: result.storeId,
    operation: "gdpr_shop_redact_processed",
    action: result.action,
  });

  return result;
}
