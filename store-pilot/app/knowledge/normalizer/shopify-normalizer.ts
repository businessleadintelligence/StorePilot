import {
  extractShopifyId,
  mapShopifyProductStatus,
  parseShopifyMoney,
  type ShopifyRawOrder,
  type ShopifyRawProduct,
} from "../mapping/shopify-mapping";
import {
  storePilotOrderSchema,
  storePilotProductSchema,
  type StorePilotOrder,
  type StorePilotProduct,
} from "../schemas/normalized-models";
import { BLOCKED_SHOPIFY_FIELDS } from "../shared/constants";

export function normalizeShopifyProduct(raw: ShopifyRawProduct): StorePilotProduct {
  const variants =
    raw.variants?.edges?.map((edge) => {
      const node = edge.node;
      return {
        shopifyVariantId: extractShopifyId(node?.id ?? ""),
        shopifyProductId: extractShopifyId(raw.id),
        sku: node?.sku ?? null,
        price: parseShopifyMoney(node?.price),
        compareAtPrice: parseShopifyMoney(node?.compareAtPrice),
        cost: parseShopifyMoney(node?.inventoryItem?.unitCost?.amount),
        inventoryQuantity: node?.inventoryQuantity ?? null,
        inventoryTracked: node?.inventoryItem?.tracked ?? true,
        shopifyInventoryItemId: node?.inventoryItem?.id
          ? extractShopifyId(node.inventoryItem.id)
          : null,
      };
    }) ?? [];

  const totalInventory = variants.reduce(
    (sum, variant) => sum + Math.max(0, variant.inventoryQuantity ?? 0),
    0,
  );

  const normalized: StorePilotProduct = {
    shopifyProductId: extractShopifyId(raw.id),
    title: sanitizeOperationalText(raw.title),
    handle: raw.handle ?? null,
    status: mapShopifyProductStatus(raw.status),
    productType: raw.productType ?? null,
    vendor: raw.vendor ?? null,
    tags: (raw.tags ?? []).map(sanitizeOperationalText),
    publishedAt: raw.publishedAt ?? null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    descriptionHtml: sanitizeOperationalText(raw.descriptionHtml ?? null),
    seo: {
      title: raw.seo?.title ?? null,
      description: raw.seo?.description ?? null,
    },
    collections:
      raw.collections?.edges?.map((edge) => ({
        shopifyCollectionId: extractShopifyId(edge.node?.id ?? ""),
        title: sanitizeOperationalText(edge.node?.title ?? "Collection"),
        productCount: edge.node?.productsCount?.count ?? 0,
      })) ?? [],
    media:
      raw.media?.edges?.map((edge) => ({
        id: extractShopifyId(edge.node?.id ?? ""),
        alt: edge.node?.alt ?? null,
        mediaContentType: edge.node?.mediaContentType ?? null,
      })) ?? [],
    variants,
    totalInventory,
  };

  return storePilotProductSchema.parse(normalized);
}

export function normalizeShopifyOrder(raw: ShopifyRawOrder): StorePilotOrder {
  const variantIdsSold =
    raw.lineItems?.edges
      ?.map((edge) => edge.node?.variant?.id)
      .filter((value): value is string => Boolean(value))
      .map(extractShopifyId) ?? [];

  const normalized: StorePilotOrder = {
    shopifyOrderId: extractShopifyId(raw.id),
    orderName: sanitizeOperationalText(raw.name),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    processedAt: raw.processedAt ?? raw.createdAt,
    cancelledAt: raw.cancelledAt ?? null,
    currencyCode: raw.currencyCode,
    subtotalAmount: parseShopifyMoney(raw.subtotalPriceSet?.shopMoney?.amount) ?? 0,
    totalPriceAmount: parseShopifyMoney(raw.totalPriceSet?.shopMoney?.amount) ?? 0,
    totalRefundedAmount: parseShopifyMoney(raw.totalRefundedSet?.shopMoney?.amount) ?? 0,
    isTest: raw.test ?? false,
    isPaid: (raw.displayFinancialStatus ?? "").toLowerCase() === "paid",
    lineItemCount: variantIdsSold.length,
    variantIdsSold,
  };

  return storePilotOrderSchema.parse(normalized);
}

export function sanitizeOperationalText(value: string | null): string {
  if (!value) {
    return "";
  }
  return value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED]")
    .replace(/\b(?:\+?\d[\d\s().-]{7,}\d)\b/g, "[REDACTED]")
    .trim();
}

export function stripBlockedFields<T extends Record<string, unknown>>(payload: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (BLOCKED_SHOPIFY_FIELDS.has(key)) {
      continue;
    }
    result[key] = value;
  }
  return result as T;
}
