import prisma from "../db.server";
import { loadUnifiedStoreMetricsForFacts } from "../ai/migration/unified-metrics-provider";
import type { GrowthIntelligenceFactsSource } from "../ai/facts/growth-intelligence-facts";

const ESTIMATED_COST_RATIO = 0.58;
const GROWTH_SOURCE_AGENTS = [
  "product_intelligence",
  "inventory_intelligence",
  "bundle_discovery",
  "store_audit",
  "seo_audit",
  "pricing_intelligence",
] as const;

function buildGrowthIntelligenceSubjectKey(storeId: string): string {
  return `growth-intelligence:${storeId}`;
}

function inferCollectionCount(productCount: number): number {
  if (productCount <= 0) return 0;
  if (productCount <= 8) return 2;
  if (productCount <= 24) return 4;
  return Math.max(4, Math.round(productCount / 8));
}

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function decimalToNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function extractHealthScore(resultJson: Record<string, unknown>): number | null {
  const score =
    resultJson.growthHealthScore ??
    resultJson.healthScore ??
    resultJson.pricingHealthScore ??
    resultJson.inventoryHealthScore ??
    resultJson.bundleHealthScore ??
    resultJson.storeHealthScore ??
    resultJson.trendHealthScore ??
    resultJson.seoHealthScore ??
    null;
  return score == null ? null : decimalToNumber(score);
}

function extractRiskScore(resultJson: Record<string, unknown>): number {
  const risks = Array.isArray(resultJson.risks) ? resultJson.risks.length : 0;
  const findings = Array.isArray(resultJson.findings) ? resultJson.findings.length : 0;
  const criticalFindings = Array.isArray(resultJson.findings)
    ? resultJson.findings.filter((entry) => {
        const record = entry as Record<string, unknown>;
        return record.severity === "critical" || record.severity === "high";
      }).length
    : 0;
  return Math.min(100, risks * 8 + criticalFindings * 6 + findings * 2);
}

function extractOpportunityCount(resultJson: Record<string, unknown>): number {
  if (Array.isArray(resultJson.opportunities)) return resultJson.opportunities.length;
  if (Array.isArray(resultJson.recommendations)) return resultJson.recommendations.length;
  return 0;
}

function extractIssueCounts(resultJson: Record<string, unknown>): {
  conversionIssueCount: number;
  mobileUxIssueCount: number;
  homepageIssueCount: number;
  productPageIssueCount: number;
} {
  const findings = Array.isArray(resultJson.findings)
    ? resultJson.findings.map((entry) => String((entry as Record<string, unknown>).category ?? ""))
    : [];
  const issues = Array.isArray(resultJson.issues)
    ? resultJson.issues.map((entry) => String((entry as Record<string, unknown>).category ?? ""))
    : [];

  const haystack = [...findings, ...issues].join(" ").toLowerCase();
  return {
    conversionIssueCount: /conversion/.test(haystack) ? 1 : 0,
    mobileUxIssueCount: /mobile|ux/.test(haystack) ? 1 : 0,
    homepageIssueCount: /homepage|home page/.test(haystack) ? 1 : 0,
    productPageIssueCount: /product page|product-page/.test(haystack) ? 1 : 0,
  };
}

export function createPrismaGrowthIntelligenceFactsSource(): GrowthIntelligenceFactsSource {
  return {
    async getGrowthIntelligenceSnapshot({ storeId }) {
      const thirtyDaysAgo = daysAgo(30);
      const sixtyDaysAgo = daysAgo(60);
      const ninetyDaysAgo = daysAgo(90);

      const [
        store,
        products,
        orders30,
        ordersPrev30,
        orders90,
        lineItems30,
        lineItems90,
        recommendations,
        agentResults,
        unifiedMetrics,
      ] = await Promise.all([
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
            id: true,
            metricDate: true,
            totalPriceAmount: true,
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
          select: { id: true, metricDate: true, totalPriceAmount: true },
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
            orderId: true,
            shopifyVariantId: true,
            shopifyProductId: true,
            quantity: true,
          },
        }),
        prisma.orderLineItem.findMany({
          where: {
            storeId,
            order: {
              cancelledAt: null,
              isTest: false,
              metricDate: { gte: ninetyDaysAgo },
            },
          },
          select: {
            orderId: true,
            shopifyProductId: true,
            quantity: true,
          },
        }),
        prisma.aiRecommendation.findMany({
          where: {
            storeId,
            subjectKey: buildGrowthIntelligenceSubjectKey(storeId),
          },
          select: {
            status: true,
            stableId: true,
            payloadJson: true,
          },
        }),
        Promise.all(
          GROWTH_SOURCE_AGENTS.map((agentId) =>
            prisma.aiAgentResult.findFirst({
              where: { storeId, agentId, isSuccess: true },
              orderBy: { createdAt: "desc" },
              select: {
                agentId: true,
                summary: true,
                confidence: true,
                resultJson: true,
                createdAt: true,
              },
            }),
          ),
        ),
        loadUnifiedStoreMetricsForFacts(storeId),
      ]);

      if (!store) {
        return null;
      }

      const variantSales30 = new Map<string, number>();
      const orderItemCounts = new Map<string, number>();
      const salesByMonth = new Map<number, number>();
      let totalLineItemQuantity30 = 0;

      for (const lineItem of lineItems30) {
        const variantId = lineItem.shopifyVariantId ?? "";
        if (variantId) {
          variantSales30.set(variantId, (variantSales30.get(variantId) ?? 0) + lineItem.quantity);
        }
        orderItemCounts.set(lineItem.orderId, (orderItemCounts.get(lineItem.orderId) ?? 0) + lineItem.quantity);
        totalLineItemQuantity30 += lineItem.quantity;
      }

      for (const lineItem of lineItems90) {
        const order = orders90.find((entry) => entry.id === lineItem.orderId);
        if (!order) continue;
        const month = new Date(order.metricDate).getUTCMonth() + 1;
        salesByMonth.set(month, (salesByMonth.get(month) ?? 0) + lineItem.quantity);
      }

      const totalRevenue30 = orders30.reduce((sum, order) => sum + Number(order.totalPriceAmount ?? 0), 0);
      const previousRevenue30 = ordersPrev30.reduce((sum, order) => sum + Number(order.totalPriceAmount ?? 0), 0);
      const totalRevenue90 = orders90.reduce((sum, order) => sum + Number(order.totalPriceAmount ?? 0), 0);
      const refundAmount30 = orders30.reduce((sum, order) => sum + Number(order.totalRefundedAmount ?? 0), 0);
      const lowBasketDepthOrders = [...orderItemCounts.values()].filter((count) => count <= 1).length;
      const multiItemOrderCount = [...orderItemCounts.values()].filter((count) => count >= 2).length;

      const productOrderCounts = new Map<string, Set<string>>();
      for (const lineItem of lineItems90) {
        const productId = lineItem.shopifyProductId ?? "";
        if (!productId) continue;
        const bucket = productOrderCounts.get(productId) ?? new Set<string>();
        bucket.add(lineItem.orderId);
        productOrderCounts.set(productId, bucket);
      }

      const repeatProductCount = [...productOrderCounts.values()].filter((orders) => orders.size >= 2).length;
      const totalProductsSold = productOrderCounts.size;

      const seenProductsByOrderDate: Array<{ orderId: string; productIds: Set<string> }> = [];
      for (const order of [...orders90].sort(
        (left, right) => left.metricDate.getTime() - right.metricDate.getTime(),
      )) {
        const productIds = new Set<string>();
        for (const lineItem of lineItems90) {
          if (lineItem.orderId !== order.id) continue;
          const productId = lineItem.shopifyProductId ?? "";
          if (productId) productIds.add(productId);
        }
        seenProductsByOrderDate.push({ orderId: order.id, productIds });
      }

      const priorProducts = new Set<string>();
      let repeatOrderCount = 0;
      for (const entry of seenProductsByOrderDate) {
        const isReturning = [...entry.productIds].some((productId) => priorProducts.has(productId));
        if (isReturning) repeatOrderCount += 1;
        for (const productId of entry.productIds) priorProducts.add(productId);
      }

      const returningCustomerRate =
        orders90.length <= 0 ? 0 : Math.round((repeatOrderCount / orders90.length) * 100);

      const activeProducts = products.map((product) => {
        const price = Number(product.price ?? 0);
        const unitsSold30 = variantSales30.get(product.shopifyVariantId) ?? 0;
        return {
          productId: product.id,
          title: product.title,
          price,
          inventory: product.inventoryQuantity ?? 0,
          unitsSold30,
          velocity: Number((unitsSold30 / 4).toFixed(2)),
        };
      });

      const prices = activeProducts.map((product) => product.price).filter((price) => price > 0);
      const sortedPrices = [...prices].sort((left, right) => left - right);
      const medianPrice = sortedPrices[Math.floor(sortedPrices.length / 2)] ?? 0;
      const totalInventoryUnits = activeProducts.reduce((sum, product) => sum + product.inventory, 0);
      const totalUnitsSold30 = activeProducts.reduce((sum, product) => sum + product.unitsSold30, 0);
      const slowMoverCount = activeProducts.filter((product) => product.unitsSold30 <= 1 && product.inventory > 5).length;
      const fastMoverCount = activeProducts.filter((product) => product.unitsSold30 >= 4).length;
      const heroProductCount = activeProducts.filter((product) => product.unitsSold30 >= 3).length;
      const premiumProductCount = activeProducts.filter((product) => product.price >= medianPrice * 1.2).length;
      const productsAboveMedian = activeProducts.filter((product) => product.price > medianPrice).length;
      const outOfStockProducts = activeProducts.filter((product) => product.inventory <= 0).length;
      const lowStockProducts = activeProducts.filter(
        (product) => product.inventory > 0 && product.inventory <= 5,
      ).length;

      const collectionCount = inferCollectionCount(activeProducts.length);
      const productsPerCollection =
        collectionCount <= 0 ? 0 : Number((activeProducts.length / collectionCount).toFixed(2));
      const thinCollectionCount = Math.max(0, Math.floor(collectionCount / 3));
      const missingCollectionDescriptions = Math.max(0, collectionCount - 2);

      const implementedRecommendationIds: string[] = [];
      const dismissedRecommendationIds: string[] = [];
      let openGrowthRecommendations = 0;
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
        if (status === "open" || status === "viewed") {
          openGrowthRecommendations += 1;
        }
      }

      const agentSnapshots = agentResults
        .filter((record): record is NonNullable<typeof record> => record != null)
        .map((record) => {
          const resultJson = (record.resultJson as Record<string, unknown> | null) ?? {};
          const issueCounts = extractIssueCounts(resultJson);
          return {
            agentId: record.agentId,
            summary: record.summary,
            confidence: record.confidence == null ? null : decimalToNumber(record.confidence),
            healthScore: extractHealthScore(resultJson),
            riskScore: extractRiskScore(resultJson),
            opportunityCount: extractOpportunityCount(resultJson),
            createdAt: record.createdAt.toISOString(),
            ...issueCounts,
          };
        });

      const productAgent = agentSnapshots.find((entry) => entry.agentId === "product_intelligence");
      const inventoryAgent = agentSnapshots.find((entry) => entry.agentId === "inventory_intelligence");
      const bundleAgent = agentSnapshots.find((entry) => entry.agentId === "bundle_discovery");
      const storeAuditAgent = agentSnapshots.find((entry) => entry.agentId === "store_audit");
      const seoAgent = agentSnapshots.find((entry) => entry.agentId === "seo_audit");
      const pricingAgent = agentSnapshots.find((entry) => entry.agentId === "pricing_intelligence");

      const aov30 = orders30.length <= 0 ? 0 : Number((totalRevenue30 / orders30.length).toFixed(2));
      const previousAov30 =
        ordersPrev30.length <= 0 ? 0 : Number((previousRevenue30 / ordersPrev30.length).toFixed(2));
      const itemsPerOrder =
        orders30.length <= 0 ? 0 : Number((totalLineItemQuantity30 / orders30.length).toFixed(2));
      const multiItemOrderRate =
        orders30.length <= 0 ? 0 : Math.round((multiItemOrderCount / orders30.length) * 100);
      const attachRateProxy =
        activeProducts.length <= 0 ? 0 : Number(Math.min(0.65, fastMoverCount / activeProducts.length).toFixed(2));
      const bundleCandidateCount = Math.max(0, Math.floor(fastMoverCount / 2));
      const complementaryPairCount = Math.max(0, Math.floor(bundleCandidateCount * 0.75));

      return {
        storeName: store.storeName,
        estimatedCostRatio: ESTIMATED_COST_RATIO,
        estimatedMarginPercent: Math.round((1 - ESTIMATED_COST_RATIO) * 100),
        activeProducts,
        totalRevenue30: Number(totalRevenue30.toFixed(2)),
        totalRevenue90: Number(totalRevenue90.toFixed(2)),
        previousRevenue30: Number(previousRevenue30.toFixed(2)),
        totalOrders30: orders30.length,
        totalOrders90: orders90.length,
        aov30,
        previousAov30,
        itemsPerOrder,
        refundAmount30: Number(refundAmount30.toFixed(2)),
        returningCustomerRate,
        repeatProductCount,
        totalProductsSold,
        repeatOrderCount,
        lowBasketDepthOrders,
        multiItemOrderRate,
        attachRateProxy,
        bundleCandidateCount,
        complementaryPairCount,
        collectionCount,
        productsPerCollection,
        thinCollectionCount,
        missingCollectionDescriptions,
        slowMoverCount,
        fastMoverCount,
        heroProductCount,
        premiumProductCount,
        productsAboveMedian,
        medianPrice,
        totalInventoryUnits,
        totalUnitsSold30,
        outOfStockProducts,
        lowStockProducts,
        openGrowthRecommendations,
        implementedRecommendationCount: implementedRecommendationIds.length,
        implementedRecommendationIds,
        dismissedRecommendationIds,
        salesByMonth: [...salesByMonth.entries()].map(([month, quantity]) => ({ month, quantity })),
        agentSnapshots: agentSnapshots.map(({ agentId, summary, confidence, healthScore, riskScore, opportunityCount, createdAt }) => ({
          agentId,
          summary,
          confidence,
          healthScore,
          riskScore,
          opportunityCount,
          createdAt,
        })),
        persistedSignals: {
          productHealthScore: productAgent?.healthScore ?? null,
          inventoryHealthScore: inventoryAgent?.healthScore ?? null,
          bundleOpportunityCount: bundleAgent?.opportunityCount ?? 0,
          storeAuditScore: storeAuditAgent?.healthScore ?? null,
          seoHealthScore: seoAgent?.healthScore ?? null,
          pricingHealthScore: pricingAgent?.healthScore ?? null,
          inventoryRiskScore: inventoryAgent?.riskScore ?? 0,
          pricingRiskScore: pricingAgent?.riskScore ?? 0,
          conversionIssueCount:
            (storeAuditAgent?.conversionIssueCount ?? 0) + (productAgent?.conversionIssueCount ?? 0),
          mobileUxIssueCount: storeAuditAgent?.mobileUxIssueCount ?? 0,
          homepageIssueCount: storeAuditAgent?.homepageIssueCount ?? 0,
          productPageIssueCount:
            (storeAuditAgent?.productPageIssueCount ?? 0) + (productAgent?.productPageIssueCount ?? 0),
        },
        unifiedMetrics,
      };
    },
  };
}
