import prisma from "../db.server";
import { loadUnifiedStoreMetricsForFacts } from "../ai/migration/unified-metrics-provider";
import type { ProductFactsSource } from "../ai/facts/product-facts";

function formatMetricDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function createPrismaProductFactsSource(): ProductFactsSource {
  return {
    async getProductSnapshot({ storeId, productId }) {
      const [product, unifiedMetrics] = await Promise.all([
        prisma.product.findFirst({
          where: {
            storeId,
            id: productId,
          },
        }),
        loadUnifiedStoreMetricsForFacts(storeId),
      ]);

      if (!product) {
        return null;
      }

      const now = new Date();
      const ninetyDaysAgo = new Date(now);
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const lineItems = await prisma.orderLineItem.findMany({
        where: {
          storeId,
          shopifyVariantId: product.shopifyVariantId,
          order: {
            cancelledAt: null,
            isTest: false,
            metricDate: {
              gte: ninetyDaysAgo,
            },
          },
        },
        select: {
          quantity: true,
          discountedUnitPrice: true,
          order: {
            select: {
              id: true,
              metricDate: true,
              totalRefundedAmount: true,
            },
          },
        },
      });

      const salesByDay = new Map<
        string,
        { quantity: number; revenue: number; orderIds: Set<string> }
      >();
      const refundedOrderIds = new Set<string>();
      let refundCount30Days = 0;

      for (const lineItem of lineItems) {
        const day = formatMetricDay(lineItem.order.metricDate);
        const bucket = salesByDay.get(day) ?? {
          quantity: 0,
          revenue: 0,
          orderIds: new Set<string>(),
        };

        bucket.quantity += lineItem.quantity;
        bucket.revenue += Number(lineItem.discountedUnitPrice) * lineItem.quantity;
        bucket.orderIds.add(lineItem.order.id);
        salesByDay.set(day, bucket);

        if (
          lineItem.order.metricDate >= thirtyDaysAgo &&
          Number(lineItem.order.totalRefundedAmount) > 0 &&
          !refundedOrderIds.has(lineItem.order.id)
        ) {
          refundedOrderIds.add(lineItem.order.id);
          refundCount30Days += 1;
        }
      }

      return {
        productId: product.id,
        shopifyProductId: product.shopifyProductId,
        shopifyVariantId: product.shopifyVariantId,
        title: product.title,
        vendor: null,
        category: null,
        status: product.status,
        inventory: product.inventoryQuantity,
        reservedInventory: 0,
        margin: null,
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString(),
        salesByDay: [...salesByDay.entries()].map(([day, bucket]) => ({
          day,
          quantity: bucket.quantity,
          revenue: bucket.revenue,
          orderCount: bucket.orderIds.size,
        })),
        refundCount30Days,
        unifiedMetrics,
      };
    },
  };
}
