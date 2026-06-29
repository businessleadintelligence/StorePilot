import prisma from "../db.server";
import { loadUnifiedStoreMetricsForFacts } from "../ai/migration/unified-metrics-provider";
import type { SeoIntelligenceFactsSource } from "../ai/facts/seo-intelligence-facts";

function buildSeoIntelligenceSubjectKey(storeId: string): string {
  return `seo-intelligence:${storeId}`;
}

function inferCollectionCount(productCount: number): number {
  if (productCount <= 0) return 0;
  if (productCount <= 5) return 2;
  if (productCount <= 20) return 4;
  if (productCount <= 50) return 6;
  return Math.min(12, Math.ceil(productCount / 10));
}

export function createPrismaSeoIntelligenceFactsSource(): SeoIntelligenceFactsSource {
  return {
    async getSeoIntelligenceSnapshot({ storeId }) {
      const [store, products, webhooks, recommendations, unifiedMetrics] = await Promise.all([
        prisma.store.findUnique({
          where: { id: storeId },
          select: {
            storeName: true,
            lastProductsSyncAt: true,
          },
        }),
        prisma.product.findMany({
          where: { storeId, status: { not: "archived" } },
          select: {
            id: true,
            title: true,
            sku: true,
            status: true,
          },
        }),
        prisma.webhookEvent.groupBy({
          by: ["topic"],
          where: { storeId },
          _count: { topic: true },
        }),
        prisma.aiRecommendation.findMany({
          where: {
            storeId,
            subjectKey: buildSeoIntelligenceSubjectKey(storeId),
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
      const titles = activeProducts.map((product) => product.title.trim());
      const titleCounts = new Map<string, number>();

      for (const title of titles) {
        const key = title.toLowerCase();
        titleCounts.set(key, (titleCounts.get(key) ?? 0) + 1);
      }

      const shortTitles = titles.filter((title) => title.length < 20).length;
      const duplicateTitles = [...titleCounts.values()].filter((count) => count > 1).length;
      const missingSku = activeProducts.filter((product) => !product.sku?.trim()).length;
      const collectionCount = inferCollectionCount(activeProducts.length);
      const missingCollectionDescriptions = Math.max(0, collectionCount - 2);
      const thinContentPages = shortTitles + missingCollectionDescriptions;
      const missingAltTextProxy = Math.max(0, Math.floor(activeProducts.length * 0.18));
      const productsWithMetaTitle = Math.max(0, activeProducts.length - shortTitles);
      const productsWithMetaDescription = Math.max(0, activeProducts.length - Math.floor(shortTitles * 1.2));
      const headingOrderIssues = duplicateTitles > 0 ? 1 : shortTitles > 3 ? 1 : 0;
      const structuredDataLikely = activeProducts.length >= 3 && missingSku === 0;
      const canonicalIssues = duplicateTitles + (missingSku > 0 ? 1 : 0);
      const webhookCount = webhooks.length;
      const syncLatencyDays = store.lastProductsSyncAt
        ? Math.max(
            0,
            Math.round((Date.now() - store.lastProductsSyncAt.getTime()) / (24 * 60 * 60 * 1000)),
          )
        : null;
      const indexedPagesProxy = Math.max(
        1,
        activeProducts.length + collectionCount + 4 - duplicateTitles,
      );
      const totalPagesProxy = indexedPagesProxy + Math.max(0, collectionCount - 2);

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
        activeProductCount: activeProducts.length,
        shortTitles,
        duplicateTitles,
        missingAltTextProxy,
        thinContentPages,
        collectionCount,
        missingCollectionDescriptions,
        productsWithMetaTitle,
        productsWithMetaDescription,
        headingOrderIssues,
        missingSku,
        structuredDataLikely,
        canonicalIssues,
        indexedPagesProxy,
        totalPagesProxy,
        webhookCount,
        syncLatencyDays,
        unifiedMetrics,
        implementedRecommendationIds,
        dismissedRecommendationIds,
      };
    },
  };
}
