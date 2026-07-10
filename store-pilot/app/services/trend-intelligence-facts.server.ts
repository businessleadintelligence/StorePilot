import prisma from "../db.server";
import { orderWhereForMetrics } from "../lib/order-query-filters.server";
import type { TrendFactsSource } from "../ai/facts/trend-facts";

function formatMetricDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildTrendSubjectKey(storeId: string): string {
  return `trend:${storeId}`;
}

export function createPrismaTrendFactsSource(): TrendFactsSource {
  return {
    async getStoreTrendSnapshot({ storeId }) {
      const products = await prisma.product.findMany({
        where: { storeId, status: { not: "archived" } },
        select: {
          id: true,
          title: true,
          inventoryQuantity: true,
          shopifyVariantId: true,
        },
      });

      if (products.length === 0) {
        return {
          products: [],
          storeRevenue7Days: 0,
          storeRevenue30Days: 0,
          storeRevenuePrior30Days: 0,
          salesByMonth: [],
          implementedRecommendationIds: [],
          dismissedRecommendationIds: [],
        };
      }

      const now = new Date();
      const ninetyDaysAgo = new Date(now);
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const sixtyDaysAgo = new Date(now);
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const variantIds = products.map((product) => product.shopifyVariantId);

      const [lineItems, storeOrders, recommendations] = await Promise.all([
        prisma.orderLineItem.findMany({
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
            discountedUnitPrice: true,
            order: { select: { metricDate: true } },
          },
        }),
        prisma.order.findMany({
          where: orderWhereForMetrics(storeId, {
            cancelledAt: null,
            isTest: false,
            metricDate: { gte: sixtyDaysAgo },
          }),
          select: {
            metricDate: true,
            totalPriceAmount: true,
          },
        }),
        prisma.aiRecommendation.findMany({
          where: {
            storeId,
            subjectKey: buildTrendSubjectKey(storeId),
          },
          select: {
            status: true,
            stableId: true,
            payloadJson: true,
          },
        }),
      ]);

      const salesByVariant = new Map<string, Map<string, { quantity: number; revenue: number }>>();
      const salesPriorByVariant = new Map<string, number>();
      const salesByMonth = new Map<number, number>();

      for (const lineItem of lineItems) {
        if (!lineItem.shopifyVariantId) continue;
        const day = formatMetricDay(lineItem.order.metricDate);
        const month = lineItem.order.metricDate.getUTCMonth() + 1;
        const bucket =
          salesByVariant.get(lineItem.shopifyVariantId) ??
          new Map<string, { quantity: number; revenue: number }>();
        const dayBucket = bucket.get(day) ?? { quantity: 0, revenue: 0 };
        dayBucket.quantity += lineItem.quantity;
        dayBucket.revenue += Number(lineItem.discountedUnitPrice) * lineItem.quantity;
        bucket.set(day, dayBucket);
        salesByVariant.set(lineItem.shopifyVariantId, bucket);
        salesByMonth.set(month, (salesByMonth.get(month) ?? 0) + lineItem.quantity);

        if (lineItem.order.metricDate < thirtyDaysAgo && lineItem.order.metricDate >= sixtyDaysAgo) {
          salesPriorByVariant.set(
            lineItem.shopifyVariantId,
            (salesPriorByVariant.get(lineItem.shopifyVariantId) ?? 0) + lineItem.quantity,
          );
        }
      }

      const storeRevenue7Days = storeOrders
        .filter((order) => order.metricDate >= thirtyDaysAgo)
        .slice(-7)
        .reduce((total, order) => total + Number(order.totalPriceAmount ?? 0), 0);
      const storeRevenue30Days = storeOrders
        .filter((order) => order.metricDate >= thirtyDaysAgo)
        .reduce((total, order) => total + Number(order.totalPriceAmount ?? 0), 0);
      const storeRevenuePrior30Days = storeOrders
        .filter((order) => order.metricDate < thirtyDaysAgo && order.metricDate >= sixtyDaysAgo)
        .reduce((total, order) => total + Number(order.totalPriceAmount ?? 0), 0);

      const implementedRecommendationIds: string[] = [];
      const dismissedRecommendationIds: string[] = [];

      for (const record of recommendations) {
        const payload = (record.payloadJson ?? {}) as Record<string, unknown>;
        const recommendationId = String(payload.id ?? record.stableId);
        const status = record.status.toLowerCase();
        if (status === "implemented" || status === "verified" || status === "closed") {
          implementedRecommendationIds.push(recommendationId);
        }
        if (status === "dismissed") {
          dismissedRecommendationIds.push(recommendationId);
        }
      }

      return {
        products: products.map((product) => ({
          productId: product.id,
          title: product.title,
          inventory: product.inventoryQuantity,
          salesByDay: [...(salesByVariant.get(product.shopifyVariantId)?.entries() ?? [])].map(
            ([day, values]) => ({
              day,
              quantity: values.quantity,
              revenue: values.revenue,
            }),
          ),
          salesPrior30Days: salesPriorByVariant.get(product.shopifyVariantId) ?? 0,
        })),
        storeRevenue7Days,
        storeRevenue30Days,
        storeRevenuePrior30Days,
        salesByMonth: [...salesByMonth.entries()].map(([month, quantity]) => ({ month, quantity })),
        implementedRecommendationIds,
        dismissedRecommendationIds,
      };
    },
  };
}
