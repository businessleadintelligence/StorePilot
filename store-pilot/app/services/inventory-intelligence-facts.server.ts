import prisma from "../db.server";
import { loadUnifiedStoreMetricsForFacts } from "../ai/migration/unified-metrics-provider";
import type { InventoryFactsSource } from "../ai/facts/inventory-facts";

function formatMetricDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function createPrismaInventoryFactsSource(): InventoryFactsSource {
  return {
    async getStoreInventorySnapshot({ storeId }) {
      const [products, unifiedMetrics] = await Promise.all([
        prisma.product.findMany({
          where: {
            storeId,
            status: { not: "archived" },
          },
          select: {
            id: true,
            title: true,
            sku: true,
            inventoryQuantity: true,
            price: true,
            updatedAt: true,
            shopifyVariantId: true,
          },
        }),
        loadUnifiedStoreMetricsForFacts(storeId),
      ]);

      if (products.length === 0) {
        return { products: [], unifiedMetrics };
      }

      const now = new Date();
      const ninetyDaysAgo = new Date(now);
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const variantIds = products.map((product) => product.shopifyVariantId);
      const lineItems = await prisma.orderLineItem.findMany({
        where: {
          storeId,
          shopifyVariantId: { in: variantIds },
          order: {
            cancelledAt: null,
            isTest: false,
            metricDate: { gte: ninetyDaysAgo },
          },
        },
        select: {
          shopifyVariantId: true,
          quantity: true,
          order: {
            select: {
              metricDate: true,
            },
          },
        },
      });

      const salesByVariant = new Map<string, Map<string, number>>();
      for (const lineItem of lineItems) {
        if (!lineItem.shopifyVariantId) {
          continue;
        }

        const day = formatMetricDay(lineItem.order.metricDate);
        const bucket = salesByVariant.get(lineItem.shopifyVariantId) ?? new Map<string, number>();
        bucket.set(day, (bucket.get(day) ?? 0) + lineItem.quantity);
        salesByVariant.set(lineItem.shopifyVariantId, bucket);
      }

      return {
        products: products.map((product) => ({
          productId: product.id,
          title: product.title,
          sku: product.sku,
          inventory: product.inventoryQuantity,
          reservedInventory: 0,
          unitCost: product.price == null ? null : Number(product.price),
          updatedAt: product.updatedAt.toISOString(),
          salesByDay: [...(salesByVariant.get(product.shopifyVariantId)?.entries() ?? [])].map(
            ([day, quantity]) => ({ day, quantity }),
          ),
        })),
        unifiedMetrics,
      };
    },
  };
}
