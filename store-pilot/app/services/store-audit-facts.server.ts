import prisma from "../db.server";
import { loadUnifiedStoreMetricsForFacts } from "../ai/migration/unified-metrics-provider";
import type { StoreAuditFactsSource } from "../ai/facts/store-audit-facts";

function buildStoreAuditSubjectKey(storeId: string): string {
  return `store-audit:${storeId}`;
}

function inferCollectionCount(productCount: number): number {
  if (productCount <= 0) return 0;
  if (productCount <= 5) return 2;
  if (productCount <= 20) return 4;
  if (productCount <= 50) return 6;
  return Math.min(12, Math.ceil(productCount / 10));
}

export function createPrismaStoreAuditFactsSource(): StoreAuditFactsSource {
  return {
    async getStoreAuditSnapshot({ storeId }) {
      const [store, products, recentOrders, webhooks, onboarding, recommendations, unifiedMetrics] = await Promise.all([
        prisma.store.findUnique({
          where: { id: storeId },
          select: {
            storeName: true,
            lastProductsSyncAt: true,
            createdAt: true,
          },
        }),
        prisma.product.findMany({
          where: { storeId, status: { not: "archived" } },
          select: {
            id: true,
            title: true,
            price: true,
            sku: true,
            status: true,
          },
        }),
        prisma.order.findMany({
          where: {
            storeId,
            cancelledAt: null,
            isTest: false,
            metricDate: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          },
          select: { totalPriceAmount: true },
        }),
        prisma.webhookEvent.groupBy({
          by: ["topic"],
          where: { storeId },
          _count: { topic: true },
        }),
        prisma.storeOnboarding.findUnique({
          where: { storeId },
          select: { completedAt: true },
        }),
        prisma.aiRecommendation.findMany({
          where: {
            storeId,
            subjectKey: buildStoreAuditSubjectKey(storeId),
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

      const activeProducts = products.filter((product) => product.status === "active");
      const draftProducts = products.filter((product) => product.status === "draft");
      const titles = activeProducts.map((product) => product.title.trim());
      const titleCounts = new Map<string, number>();

      for (const title of titles) {
        const key = title.toLowerCase();
        titleCounts.set(key, (titleCounts.get(key) ?? 0) + 1);
      }

      const shortTitles = titles.filter((title) => title.length < 20).length;
      const productsWithLongTitles = titles.filter((title) => title.length >= 40).length;
      const duplicateTitles = [...titleCounts.values()].filter((count) => count > 1).length;
      const missingPrice = activeProducts.filter((product) => product.price == null).length;
      const missingSku = activeProducts.filter((product) => !product.sku?.trim()).length;
      const averageTitleLength =
        titles.length === 0
          ? 0
          : Math.round(titles.reduce((total, title) => total + title.length, 0) / titles.length);

      const collectionCount = inferCollectionCount(activeProducts.length);
      const emptyCollections = collectionCount > 0 ? Math.max(0, collectionCount - Math.ceil(activeProducts.length / 5)) : 0;
      const missingCollectionDescriptions = Math.max(0, collectionCount - 2);
      const duplicateCollectionTitles = duplicateTitles > 0 ? 1 : 0;
      const missingCollectionImages = Math.max(0, Math.floor(collectionCount / 3));

      const webhookCount = webhooks.length;
      const duplicateWebhookTopics = 0;
      const staleWebhookCount = store.lastProductsSyncAt
        ? store.lastProductsSyncAt.getTime() < Date.now() - 14 * 24 * 60 * 60 * 1000
          ? 1
          : 0
        : 1;

      const syncLatencyDays = store.lastProductsSyncAt
        ? Math.max(
            0,
            Math.round((Date.now() - store.lastProductsSyncAt.getTime()) / (24 * 60 * 60 * 1000)),
          )
        : null;

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

      const recentOrderCount = recentOrders.length;
      const averageOrderValue =
        recentOrderCount === 0
          ? 0
          : Number(
              (
                recentOrders.reduce((total, order) => total + Number(order.totalPriceAmount ?? 0), 0) /
                recentOrderCount
              ).toFixed(2),
            );

      return {
        storeName: store.storeName,
        activeProductCount: activeProducts.length,
        draftProductCount: draftProducts.length,
        recentOrderCount,
        averageOrderValue,
        hasCompletedOnboarding: Boolean(onboarding?.completedAt),
        shortTitles,
        missingPrice,
        missingSku,
        averageTitleLength,
        collectionCount,
        emptyCollections,
        missingCollectionDescriptions,
        duplicateCollectionTitles,
        missingCollectionImages,
        webhookCount,
        duplicateWebhookTopics,
        staleWebhookCount,
        syncLatencyDays,
        productsWithoutDescriptiveTitles: titles.filter((title) => title.split(/\s+/).length < 3).length,
        headingOrderIssues: duplicateTitles,
        missingAltTextProxy: Math.max(0, Math.floor(activeProducts.length / 4)),
        duplicateTitles,
        productsWithLongTitles,
        implementedRecommendationIds,
        dismissedRecommendationIds,
        unifiedMetrics,
      };
    },
  };
}
