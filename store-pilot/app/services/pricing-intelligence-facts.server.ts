import prisma from "../db.server";
import { loadUnifiedStoreMetricsForFacts } from "../ai/migration/unified-metrics-provider";
import type { PricingIntelligenceFactsSource } from "../ai/facts/pricing-intelligence-facts";

const ESTIMATED_COST_RATIO = 0.58;

function buildPricingIntelligenceSubjectKey(storeId: string): string {
  return `pricing-intelligence:${storeId}`;
}

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

export function createPrismaPricingIntelligenceFactsSource(): PricingIntelligenceFactsSource {
  return {
    async getPricingIntelligenceSnapshot({ storeId }) {
      const thirtyDaysAgo = daysAgo(30);
      const sixtyDaysAgo = daysAgo(60);
      const ninetyDaysAgo = daysAgo(90);

      const [store, products, orders30, ordersPrev30, orders90, lineItems30, recommendations, unifiedMetrics] =
        await Promise.all([
        prisma.store.findUnique({
          where: { id: storeId },
          select: { storeName: true },
        }),
        prisma.product.findMany({
          where: { storeId, status: "active" },
          select: {
            id: true,
            title: true,
            price: true,
            inventoryQuantity: true,
            shopifyVariantId: true,
          },
        }),
        prisma.order.findMany({
          where: {
            storeId,
            cancelledAt: null,
            isTest: false,
            metricDate: { gte: thirtyDaysAgo },
          },
          select: {
            totalPriceAmount: true,
            totalDiscountAmount: true,
            totalRefundedAmount: true,
          },
        }),
        prisma.order.findMany({
          where: {
            storeId,
            cancelledAt: null,
            isTest: false,
            metricDate: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
          },
          select: { totalPriceAmount: true },
        }),
        prisma.order.findMany({
          where: {
            storeId,
            cancelledAt: null,
            isTest: false,
            metricDate: { gte: ninetyDaysAgo },
          },
          select: { totalPriceAmount: true },
        }),
        prisma.orderLineItem.findMany({
          where: {
            storeId,
            order: {
              cancelledAt: null,
              isTest: false,
              metricDate: { gte: thirtyDaysAgo },
            },
          },
          select: {
            shopifyVariantId: true,
            quantity: true,
            originalUnitPrice: true,
            discountedUnitPrice: true,
          },
        }),
        prisma.aiRecommendation.findMany({
          where: {
            storeId,
            subjectKey: buildPricingIntelligenceSubjectKey(storeId),
          },
          select: {
            status: true,
            stableId: true,
            payloadJson: true,
          },
        }),
        loadUnifiedStoreMetricsForFacts(storeId),
      ]);

      if (!store) {
        return null;
      }

      const variantSales30 = new Map<string, number>();
      const variantSales90 = new Map<string, number>();
      const variantDiscountTotals = new Map<string, { total: number; count: number }>();
      let markdownLineItems = 0;

      for (const lineItem of lineItems30) {
        const variantId = lineItem.shopifyVariantId ?? "";
        if (!variantId) continue;

        variantSales30.set(variantId, (variantSales30.get(variantId) ?? 0) + lineItem.quantity);

        const original = Number(lineItem.originalUnitPrice);
        const discounted = Number(lineItem.discountedUnitPrice);
        if (original > 0 && discounted < original * 0.98) {
          markdownLineItems += 1;
        }

        const discountPct = original <= 0 ? 0 : ((original - discounted) / original) * 100;
        const bucket = variantDiscountTotals.get(variantId) ?? { total: 0, count: 0 };
        bucket.total += discountPct;
        bucket.count += 1;
        variantDiscountTotals.set(variantId, bucket);
      }

      const totalRevenue30 = orders30.reduce((sum, order) => sum + Number(order.totalPriceAmount ?? 0), 0);
      const previousRevenue30 = ordersPrev30.reduce((sum, order) => sum + Number(order.totalPriceAmount ?? 0), 0);
      const totalRevenue90 = orders90.reduce((sum, order) => sum + Number(order.totalPriceAmount ?? 0), 0);
      const refundAmount30 = orders30.reduce((sum, order) => sum + Number(order.totalRefundedAmount ?? 0), 0);
      const discountedOrderCount = orders30.filter((order) => Number(order.totalDiscountAmount ?? 0) > 0).length;

      let discountNumerator = 0;
      let discountDenominator = 0;
      for (const order of orders30) {
        const subtotal = Number(order.totalPriceAmount ?? 0) + Number(order.totalDiscountAmount ?? 0);
        if (subtotal > 0) {
          discountNumerator += Number(order.totalDiscountAmount ?? 0);
          discountDenominator += subtotal;
        }
      }
      const averageDiscountPercent =
        discountDenominator <= 0 ? 0 : Math.round((discountNumerator / discountDenominator) * 100);

      const activeProducts = products.map((product) => {
        const price = Number(product.price ?? 0);
        const unitsSold30 = variantSales30.get(product.shopifyVariantId) ?? 0;
        const discountBucket = variantDiscountTotals.get(product.shopifyVariantId);
        const averageProductDiscount =
          !discountBucket || discountBucket.count === 0
            ? 0
            : Math.round(discountBucket.total / discountBucket.count);

        return {
          productId: product.id,
          title: product.title,
          price,
          inventory: product.inventoryQuantity ?? 0,
          unitsSold30,
          unitsSold90: variantSales90.get(product.shopifyVariantId) ?? unitsSold30 * 3,
          averageDiscountPercent: averageProductDiscount,
          velocity: Number((unitsSold30 / 4).toFixed(2)),
        };
      });

      const totalInventoryUnits = activeProducts.reduce((sum, product) => sum + product.inventory, 0);
      const totalUnitsSold30 = activeProducts.reduce((sum, product) => sum + product.unitsSold30, 0);
      const slowMoverCount = activeProducts.filter((product) => product.unitsSold30 <= 1 && product.inventory > 5).length;
      const fastMoverCount = activeProducts.filter((product) => product.unitsSold30 >= 4).length;
      const averageWeeksOfCover =
        totalUnitsSold30 <= 0
          ? totalInventoryUnits
          : Number(((totalInventoryUnits / totalUnitsSold30) * 4).toFixed(2));

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
        storeName: store.storeName,
        estimatedCostRatio: ESTIMATED_COST_RATIO,
        activeProducts,
        totalRevenue30: Number(totalRevenue30.toFixed(2)),
        totalRevenue90: Number(totalRevenue90.toFixed(2)),
        previousRevenue30: Number(previousRevenue30.toFixed(2)),
        totalOrders30: orders30.length,
        totalOrders90: orders90.length,
        discountedOrderCount,
        averageDiscountPercent,
        markdownLineItems,
        totalLineItems: lineItems30.length,
        totalUnitsSold30,
        totalInventoryUnits,
        refundAmount30: Number(refundAmount30.toFixed(2)),
        bundleCandidateCount: Math.max(0, Math.floor(fastMoverCount / 2)),
        attachRateProxy: fastMoverCount <= 0 ? 0 : Number(Math.min(0.65, fastMoverCount / activeProducts.length).toFixed(2)),
        slowMoverCount,
        fastMoverCount,
        averageWeeksOfCover,
        implementedRecommendationIds,
        dismissedRecommendationIds,
        unifiedMetrics,
      };
    },
  };
}
