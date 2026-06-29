import prisma from "../db.server";
import { loadUnifiedStoreMetricsForFacts } from "../ai/migration/unified-metrics-provider";
import type { BundleFactsSource } from "../ai/facts/bundle-facts";

function formatMetricDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function readBundleProductIds(payload: Record<string, unknown>): string[] {
  const fromArray = payload.bundleProductIds;
  if (Array.isArray(fromArray)) {
    return fromArray.map(String).filter(Boolean);
  }

  const candidate = payload.bundleCandidates as { productIds?: string[] } | undefined;
  if (candidate?.productIds?.length) {
    return candidate.productIds;
  }

  return [];
}

export function createPrismaBundleFactsSource(): BundleFactsSource {
  return {
    async getStoreBundleSnapshot({ storeId }) {
      const unifiedMetrics = await loadUnifiedStoreMetricsForFacts(storeId);
      const products = await prisma.product.findMany({
        where: {
          storeId,
          status: { not: "archived" },
        },
        select: {
          id: true,
          title: true,
          sku: true,
          shopifyProductId: true,
          shopifyVariantId: true,
          price: true,
          inventoryQuantity: true,
          updatedAt: true,
        },
      });

      if (products.length === 0) {
        return {
          products: [],
          orders: [],
          implementedBundleProductSets: [],
          bundleRecommendationCount: 0,
          verifiedBundleCount: 0,
          unifiedMetrics,
        };
      }

      const now = new Date();
      const ninetyDaysAgo = new Date(now);
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const variantToProductId = new Map(
        products.map((product) => [product.shopifyVariantId, product.id]),
      );
      const variantIds = products.map((product) => product.shopifyVariantId);

      const [lineItems, bundleRecommendations] = await Promise.all([
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
            orderId: true,
            order: {
              select: {
                metricDate: true,
              },
            },
          },
        }),
        prisma.aiRecommendation.findMany({
          where: {
            storeId,
            agentId: "bundle_discovery",
          },
          select: {
            status: true,
            payloadJson: true,
          },
        }),
      ]);

      const salesByVariant = new Map<string, Map<string, number>>();
      const ordersById = new Map<string, Set<string>>();

      for (const lineItem of lineItems) {
        if (!lineItem.shopifyVariantId) {
          continue;
        }

        const day = formatMetricDay(lineItem.order.metricDate);
        const bucket = salesByVariant.get(lineItem.shopifyVariantId) ?? new Map<string, number>();
        bucket.set(day, (bucket.get(day) ?? 0) + lineItem.quantity);
        salesByVariant.set(lineItem.shopifyVariantId, bucket);

        const productId = variantToProductId.get(lineItem.shopifyVariantId);
        if (!productId) {
          continue;
        }

        const orderProducts = ordersById.get(lineItem.orderId) ?? new Set<string>();
        orderProducts.add(productId);
        ordersById.set(lineItem.orderId, orderProducts);
      }

      const implementedBundleProductSets: string[][] = [];
      let verifiedBundleCount = 0;

      for (const recommendation of bundleRecommendations) {
        const productIds = readBundleProductIds(recommendation.payloadJson as Record<string, unknown>);
        if (productIds.length >= 2) {
          if (["implemented", "verified", "closed"].includes(recommendation.status)) {
            implementedBundleProductSets.push(productIds);
          }

          if (recommendation.status === "verified") {
            verifiedBundleCount += 1;
          }
        }
      }

      return {
        products: products.map((product) => ({
          productId: product.id,
          title: product.title,
          sku: product.sku,
          shopifyProductId: product.shopifyProductId,
          shopifyVariantId: product.shopifyVariantId,
          price: product.price == null ? null : Number(product.price),
          inventory: product.inventoryQuantity,
          updatedAt: product.updatedAt.toISOString(),
          salesByDay: [...(salesByVariant.get(product.shopifyVariantId)?.entries() ?? [])].map(
            ([day, quantity]) => ({ day, quantity }),
          ),
        })),
        orders: [...ordersById.values()].map((productIds) =>
          [...productIds].map((productId) => ({ productId })),
        ),
        implementedBundleProductSets,
        bundleRecommendationCount: bundleRecommendations.length,
        verifiedBundleCount,
        unifiedMetrics,
      };
    },
  };
}
