import prisma from "../../db.server";
import { orderWhereForMetrics } from "../../lib/order-query-filters.server";
import {
  mapDbOrderRow,
  mapDbProductRowToVariant,
  mapProductStatusToStorePilot,
} from "../mapping/shopify-mapping";
import type { StorePilotOrder, StorePilotProduct } from "../schemas/normalized-models";

export async function loadNormalizedProductsFromDb(input: {
  storeId: string;
  skip?: number;
  take?: number;
}): Promise<StorePilotProduct[]> {
  const take = input.take ?? 50;
  const skip = input.skip ?? 0;
  const rows = await prisma.product.findMany({
    where: { storeId: input.storeId },
    orderBy: { updatedAt: "asc" },
    skip,
    take,
  });

  const grouped = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = grouped.get(row.shopifyProductId) ?? [];
    list.push(row);
    grouped.set(row.shopifyProductId, list);
  }

  return [...grouped.entries()].map(([shopifyProductId, variants]) => {
    const first = variants[0];
    const normalizedVariants = variants.map(mapDbProductRowToVariant);
    return {
      shopifyProductId,
      title: first.title,
      handle: null,
      status: mapProductStatusToStorePilot(first.status),
      productType: null,
      vendor: null,
      tags: [],
      publishedAt: first.createdAt.toISOString(),
      createdAt: first.createdAt.toISOString(),
      updatedAt: first.updatedAt.toISOString(),
      descriptionHtml: null,
      seo: { title: null, description: null },
      collections: [],
      media: [],
      variants: normalizedVariants,
      totalInventory: normalizedVariants.reduce(
        (sum, variant) => sum + Math.max(0, variant.inventoryQuantity ?? 0),
        0,
      ),
    } satisfies StorePilotProduct;
  });
}

export async function loadNormalizedOrdersFromDb(input: {
  storeId: string;
  skip?: number;
  take?: number;
}): Promise<StorePilotOrder[]> {
  const orders = await prisma.order.findMany({
    where: orderWhereForMetrics(input.storeId, { isTest: false }),
    include: { lineItems: true },
    orderBy: { shopifyUpdatedAt: "asc" },
    skip: input.skip ?? 0,
    take: input.take ?? 50,
  });
  return orders.map((order) =>
    mapDbOrderRow({
      shopifyOrderId: order.shopifyOrderId,
      orderName: order.orderName,
      shopifyCreatedAt: order.shopifyCreatedAt,
      shopifyUpdatedAt: order.shopifyUpdatedAt,
      processedAt: order.processedAt,
      cancelledAt: order.cancelledAt,
      currencyCode: order.currencyCode,
      subtotalAmount: order.subtotalAmount,
      totalPriceAmount: order.totalPriceAmount,
      totalRefundedAmount: order.totalRefundedAmount,
      isTest: order.isTest,
      isPaid: order.isPaid,
      lineItems: order.lineItems,
    }),
  );
}

export async function loadSoldVariantIds(storeId: string): Promise<Set<string>> {
  const rows = await prisma.orderLineItem.findMany({
    where: {
      storeId,
      privacyRedacted: false,
      shopifyVariantId: { not: null },
    },
    select: { shopifyVariantId: true },
    distinct: ["shopifyVariantId"],
  });
  return new Set(
    rows
      .map((row) => row.shopifyVariantId)
      .filter((value): value is string => Boolean(value)),
  );
}

export async function countStoreProducts(storeId: string): Promise<number> {
  const groups = await prisma.product.groupBy({
    by: ["shopifyProductId"],
    where: { storeId },
  });
  return groups.length;
}

export async function countStoreOrders(storeId: string): Promise<number> {
  return prisma.order.count({
    where: orderWhereForMetrics(storeId, { isTest: false }),
  });
}
