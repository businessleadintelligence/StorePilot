import type { ProductStatus } from "@prisma/client";

import type {
  StorePilotOrder,
  StorePilotProduct,
  StorePilotVariant,
} from "../schemas/normalized-models";

export type ShopifyRawProduct = {
  id: string;
  title: string;
  handle?: string | null;
  status?: string | null;
  productType?: string | null;
  vendor?: string | null;
  tags?: string[];
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  descriptionHtml?: string | null;
  seo?: { title?: string | null; description?: string | null } | null;
  collections?: {
    edges?: Array<{ node?: { id?: string; title?: string; productsCount?: { count?: number } } }>;
  } | null;
  media?: {
    edges?: Array<{ node?: { id?: string; alt?: string | null; mediaContentType?: string | null } }>;
  } | null;
  variants?: {
    edges?: Array<{
      node?: {
        id?: string;
        sku?: string | null;
        price?: string | null;
        compareAtPrice?: string | null;
        inventoryQuantity?: number | null;
        inventoryItem?: {
          id?: string;
          tracked?: boolean;
          unitCost?: { amount?: string | null } | null;
        } | null;
      };
    }>;
  } | null;
};

export type ShopifyRawOrder = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  processedAt?: string | null;
  cancelledAt?: string | null;
  currencyCode: string;
  subtotalPriceSet?: { shopMoney?: { amount?: string } };
  totalPriceSet?: { shopMoney?: { amount?: string } };
  totalRefundedSet?: { shopMoney?: { amount?: string } };
  test?: boolean;
  displayFinancialStatus?: string | null;
  lineItems?: {
    edges?: Array<{ node?: { variant?: { id?: string | null } | null } }>;
  };
};

export function mapShopifyProductStatus(
  status: string | null | undefined,
): StorePilotProduct["status"] {
  switch ((status ?? "").toLowerCase()) {
    case "active":
      return "active";
    case "archived":
      return "archived";
    case "draft":
      return "draft";
    default:
      return "unknown";
  }
}

export function mapProductStatusToStorePilot(
  status: ProductStatus,
): StorePilotProduct["status"] {
  switch (status) {
    case "active":
      return "active";
    case "archived":
      return "archived";
    case "draft":
      return "draft";
    default:
      return "unknown";
  }
}

export function parseShopifyMoney(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value.trim() === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function extractShopifyId(gid: string): string {
  const parts = gid.split("/");
  return parts.at(-1) ?? gid;
}

export function mapDbProductRowToVariant(row: {
  shopifyProductId: string;
  shopifyVariantId: string;
  sku: string | null;
  price: { toString(): string } | null;
  inventoryQuantity: number | null;
  inventoryTracked: boolean;
  shopifyInventoryItemId: string | null;
}): StorePilotVariant {
  return {
    shopifyVariantId: row.shopifyVariantId,
    shopifyProductId: row.shopifyProductId,
    sku: row.sku,
    price: row.price ? Number(row.price.toString()) : null,
    compareAtPrice: null,
    cost: null,
    inventoryQuantity: row.inventoryQuantity,
    inventoryTracked: row.inventoryTracked,
    shopifyInventoryItemId: row.shopifyInventoryItemId,
  };
}

export function mapDbOrderRow(input: {
  shopifyOrderId: string;
  orderName: string;
  shopifyCreatedAt: Date;
  shopifyUpdatedAt: Date;
  processedAt: Date;
  cancelledAt: Date | null;
  currencyCode: string;
  subtotalAmount: { toString(): string };
  totalPriceAmount: { toString(): string };
  totalRefundedAmount: { toString(): string };
  isTest: boolean;
  isPaid: boolean;
  lineItems: Array<{ shopifyVariantId: string | null }>;
}): StorePilotOrder {
  return {
    shopifyOrderId: input.shopifyOrderId,
    orderName: input.orderName,
    createdAt: input.shopifyCreatedAt.toISOString(),
    updatedAt: input.shopifyUpdatedAt.toISOString(),
    processedAt: input.processedAt.toISOString(),
    cancelledAt: input.cancelledAt?.toISOString() ?? null,
    currencyCode: input.currencyCode,
    subtotalAmount: Number(input.subtotalAmount.toString()),
    totalPriceAmount: Number(input.totalPriceAmount.toString()),
    totalRefundedAmount: Number(input.totalRefundedAmount.toString()),
    isTest: input.isTest,
    isPaid: input.isPaid,
    lineItemCount: input.lineItems.length,
    variantIdsSold: input.lineItems
      .map((item) => item.shopifyVariantId)
      .filter((value): value is string => Boolean(value)),
  };
}
