import { buildFactFingerprint } from "../cache/fingerprint";
import { getRevenueMetrics } from "../migration/unified-metrics-migration";
import type { UnifiedStoreMetrics } from "../../connectors/normalization/normalized-metrics";
import { analyzePricingBundle } from "../tools/pricing-bundle-tool";
import { analyzePricingCompetition } from "../tools/pricing-competition-tool";
import { analyzePricingConversion } from "../tools/pricing-conversion-tool";
import { analyzePricingDemand } from "../tools/pricing-demand-tool";
import { analyzePricingDiscount } from "../tools/pricing-discount-tool";
import { analyzePricingElasticity } from "../tools/pricing-elasticity-tool";
import { analyzePricingInventory } from "../tools/pricing-inventory-tool";
import { analyzePricingMargin } from "../tools/pricing-margin-tool";
import { analyzePricingPremium } from "../tools/pricing-premium-tool";
import { analyzePricingProfit } from "../tools/pricing-profit-tool";
import { analyzePricingPsychology } from "../tools/pricing-psychology-tool";
import { analyzePricingRevenue } from "../tools/pricing-revenue-tool";
import { analyzePriceConsistency, analyzePricingRisk } from "../tools/pricing-risk-tool";
import {
  buildPricingHealthExplanation,
  calculatePricingIntelligenceHealthScore,
  estimateMarkdownPercent,
  estimatePricePositionScore,
  estimateSellThrough,
} from "../tools/pricing-health-tool";
import {
  calculatePricingIntelligenceScores,
  type PricingIntelligenceScores,
} from "../tools/pricing-score-tool";
import type { FactBuilder, FactBuilderContext } from "./types";

export type PricingProductSnapshot = {
  productId: string;
  title: string;
  price: number;
  inventory: number;
  unitsSold30: number;
  unitsSold90: number;
  averageDiscountPercent: number;
  velocity: number;
};

export type PricingIntelligenceFacts = {
  storeId: string;
  storeName: string;
  computedAt: string;
  pricingHealthScore: number;
  scores: PricingIntelligenceScores;
  criticalIssueCount: number;
  revenueOpportunity: number;
  profitOpportunity: number;
  storeTotals: {
    activeProducts: number;
    totalInventoryUnits: number;
    totalRevenue30: number;
    totalRevenue90: number;
    totalOrders30: number;
    refundRate: number;
  };
  margin: ReturnType<typeof analyzePricingMargin>;
  discount: ReturnType<typeof analyzePricingDiscount>;
  elasticity: ReturnType<typeof analyzePricingElasticity>;
  psychology: ReturnType<typeof analyzePricingPsychology>;
  premium: ReturnType<typeof analyzePricingPremium>;
  competition: ReturnType<typeof analyzePricingCompetition>;
  inventory: ReturnType<typeof analyzePricingInventory>;
  revenue: ReturnType<typeof analyzePricingRevenue>;
  profit: ReturnType<typeof analyzePricingProfit>;
  demand: ReturnType<typeof analyzePricingDemand>;
  conversion: ReturnType<typeof analyzePricingConversion>;
  bundle: ReturnType<typeof analyzePricingBundle>;
  risk: ReturnType<typeof analyzePricingRisk>;
  priceConsistency: ReturnType<typeof analyzePriceConsistency>;
  strategySignals: {
    premiumCandidates: number;
    lossLeaderCandidates: number;
    bundleFirstCandidates: number;
    neverDiscountCandidates: number;
    gradualRaiseCandidates: number;
    immediateRaiseCandidates: number;
    priceSensitiveProducts: number;
  };
  merchantPricingPreferences: {
    prefersPremiumPositioning: boolean;
    avoidsDeepDiscounts: boolean;
    prefersBundlePricing: boolean;
  };
  products: PricingProductSnapshot[];
  implementedRecommendationIds: string[];
  dismissedRecommendationIds: string[];
};

export type PricingIntelligenceFactsSource = {
  getPricingIntelligenceSnapshot(input: { storeId: string }): Promise<{
    storeName: string;
    estimatedCostRatio: number;
    activeProducts: PricingProductSnapshot[];
    totalRevenue30: number;
    totalRevenue90: number;
    previousRevenue30: number;
    totalOrders30: number;
    totalOrders90: number;
    discountedOrderCount: number;
    averageDiscountPercent: number;
    markdownLineItems: number;
    totalLineItems: number;
    totalUnitsSold30: number;
    totalInventoryUnits: number;
    refundAmount30: number;
    bundleCandidateCount: number;
    attachRateProxy: number;
    slowMoverCount: number;
    fastMoverCount: number;
    averageWeeksOfCover: number;
    implementedRecommendationIds: string[];
    dismissedRecommendationIds: string[];
    unifiedMetrics: UnifiedStoreMetrics;
  } | null>;
};

function countCriticalIssues(sections: Array<{ issues: string[] }>): number {
  return sections.reduce((total, section) => total + section.issues.length, 0);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

export function createPricingIntelligenceFactsBuilder(
  source: PricingIntelligenceFactsSource,
): FactBuilder<PricingIntelligenceFacts> {
  return {
    agentId: "pricing_intelligence",
    async build(context: FactBuilderContext): Promise<PricingIntelligenceFacts> {
      const snapshot = await source.getPricingIntelligenceSnapshot({ storeId: context.storeId });
      if (!snapshot) {
        throw new Error("pricing_intelligence_facts_unavailable");
      }

      const computedAt = new Date().toISOString();
      const unifiedRevenue = getRevenueMetrics(snapshot.unifiedMetrics);
      const totalRevenue30 =
        unifiedRevenue.status === "available" && (unifiedRevenue.value?.revenue ?? 0) > 0
          ? unifiedRevenue.value!.revenue
          : snapshot.totalRevenue30;
      const prices = snapshot.activeProducts.map((product) => product.price).filter((price) => price > 0);
      const medianPrice = median(prices);
      const margin = analyzePricingMargin({
        totalRevenue: totalRevenue30,
        estimatedCostRatio: snapshot.estimatedCostRatio,
      });
      const previousMargin = analyzePricingMargin({
        totalRevenue: snapshot.previousRevenue30,
        estimatedCostRatio: snapshot.estimatedCostRatio,
      });
      const discountFrequency =
        snapshot.totalOrders30 <= 0
          ? 0
          : Math.round((snapshot.discountedOrderCount / snapshot.totalOrders30) * 100);
      const discount = analyzePricingDiscount({
        averageDiscountPercent: snapshot.averageDiscountPercent,
        discountFrequency,
        discountedOrderCount: snapshot.discountedOrderCount,
        totalOrders: snapshot.totalOrders30,
      });
      const velocity =
        snapshot.activeProducts.length === 0
          ? 0
          : Number(
              (
                snapshot.totalUnitsSold30 / Math.max(1, snapshot.activeProducts.length)
              ).toFixed(2),
            );
      const conversionRate =
        snapshot.activeProducts.length <= 0
          ? 0
          : Number((snapshot.totalOrders30 / (snapshot.activeProducts.length * 120)).toFixed(4));
      const visitorProxy = snapshot.activeProducts.length * 120;
      const revenuePerVisitor =
        visitorProxy <= 0 ? 0 : Number((totalRevenue30 / visitorProxy).toFixed(2));
      const aov =
        snapshot.totalOrders30 <= 0
          ? 0
          : Number((totalRevenue30 / snapshot.totalOrders30).toFixed(2));
      const revenue = analyzePricingRevenue({
        totalRevenue: totalRevenue30,
        previousRevenue: snapshot.previousRevenue30,
        aov,
      });
      const profit = analyzePricingProfit({
        grossProfit: margin.grossProfit,
        previousGrossProfit: previousMargin.grossProfit,
        marginPercent: margin.marginPercent,
      });
      const velocityTrend =
        snapshot.totalRevenue90 <= 0
          ? 0
          : Number(((totalRevenue30 * 3 - snapshot.totalRevenue90) / snapshot.totalRevenue90).toFixed(2));
      const elasticity = analyzePricingElasticity({
        averageDiscountPercent: snapshot.averageDiscountPercent,
        velocityTrend,
        conversionRate,
      });
      const psychology = analyzePricingPsychology({ prices });
      const premiumCandidates = snapshot.activeProducts.filter(
        (product) => product.velocity >= 2 && product.averageDiscountPercent < 5,
      ).length;
      const premium = analyzePricingPremium({
        highVelocityProducts: snapshot.fastMoverCount,
        lowDiscountProducts: snapshot.activeProducts.filter((product) => product.averageDiscountPercent < 8).length,
        averageMarginPercent: margin.marginPercent,
        totalProducts: snapshot.activeProducts.length,
      });
      const competition = analyzePricingCompetition({ medianPrice, prices });
      const inventory = analyzePricingInventory({
        averageWeeksOfCover: snapshot.averageWeeksOfCover,
        slowMoverCount: snapshot.slowMoverCount,
        fastMoverCount: snapshot.fastMoverCount,
        totalProducts: snapshot.activeProducts.length,
      });
      const demand = analyzePricingDemand({
        totalUnitsSold: snapshot.totalUnitsSold30,
        totalProducts: snapshot.activeProducts.length,
        velocity,
      });
      const conversion = analyzePricingConversion({
        conversionRate,
        averageDiscountPercent: snapshot.averageDiscountPercent,
      });
      const bundle = analyzePricingBundle({
        bundleCandidateCount: snapshot.bundleCandidateCount,
        attachRateProxy: snapshot.attachRateProxy,
        totalProducts: snapshot.activeProducts.length,
      });
      const priceConsistency = analyzePriceConsistency({ prices });
      const risk = analyzePricingRisk({
        revenueRisk: revenue.revenueRisk,
        profitRisk: profit.profitRisk,
        inventoryRisk: inventory.inventoryRisk,
        discountDependence: discount.discountDependence,
      });
      const inventoryCost = Number((snapshot.totalInventoryUnits * medianPrice * snapshot.estimatedCostRatio).toFixed(2));
      const inventoryCoverage =
        snapshot.totalUnitsSold30 <= 0
          ? snapshot.totalInventoryUnits
          : Number((snapshot.totalInventoryUnits / Math.max(1, snapshot.totalUnitsSold30 / 4)).toFixed(2));
      const markdownPercent = estimateMarkdownPercent({
        markdownLineItems: snapshot.markdownLineItems,
        totalLineItems: snapshot.totalLineItems,
      });
      const sellThrough = estimateSellThrough({
        unitsSold: snapshot.totalUnitsSold30,
        inventoryUnits: snapshot.totalInventoryUnits,
      });
      const pricePositionScore = estimatePricePositionScore({ prices, medianPrice });

      const scores = calculatePricingIntelligenceScores({
        totalRevenue: totalRevenue30,
        totalGrossProfit: margin.grossProfit,
        inventoryCost,
        inventoryCoverage,
        revenuePerVisitor,
        conversionRate,
        aov,
        marginPercent: margin.marginPercent,
        averageDiscountPercent: snapshot.averageDiscountPercent,
        discountFrequency,
        pricePositionScore,
        markdownPercent,
        sellThrough,
        profitTrend: profit.profitTrend,
        velocity,
        inventoryRisk: inventory.inventoryRisk,
        bundlePriceOpportunity: bundle.bundlePriceOpportunity,
        premiumPricingOpportunity: premium.score,
        psychologicalPricingOpportunity: psychology.score,
        priceConsistencyScore: priceConsistency.priceConsistencyScore,
        discountDependence: discount.discountDependence,
        revenueRisk: revenue.revenueRisk,
        profitRisk: profit.profitRisk,
        elasticityRisk: elasticity.elasticityRisk,
      });

      const criticalIssueCount = countCriticalIssues([
        margin,
        discount,
        elasticity,
        psychology,
        premium,
        competition,
        inventory,
        revenue,
        profit,
        demand,
        conversion,
        bundle,
        risk,
        priceConsistency,
      ]);

      const pricingHealthScore = calculatePricingIntelligenceHealthScore({
        scores,
        criticalIssueCount,
      });

      const lossLeaderCandidates = snapshot.activeProducts.filter(
        (product) => product.velocity >= 3 && product.price < medianPrice * 0.7,
      ).length;
      const bundleFirstCandidates = snapshot.activeProducts.filter(
        (product) => product.velocity >= 1 && product.averageDiscountPercent > 10,
      ).length;
      const neverDiscountCandidates = snapshot.activeProducts.filter(
        (product) => product.velocity >= 2 && product.averageDiscountPercent < 3,
      ).length;
      const gradualRaiseCandidates = snapshot.activeProducts.filter(
        (product) => product.velocity >= 1 && product.averageDiscountPercent < 10 && product.price < medianPrice,
      ).length;
      const immediateRaiseCandidates = snapshot.activeProducts.filter(
        (product) => product.velocity >= 3 && product.averageDiscountPercent < 5 && product.price < medianPrice * 0.85,
      ).length;

      const revenueOpportunity = Math.round(
        Math.max(0, 100 - scores.pricingHealthScore) * 15 + premium.opportunityCount * 120,
      );
      const profitOpportunity = Math.round(
        Math.max(0, 40 - scores.marginPercent) * 25 + Math.max(0, discount.discountDependence - 30) * 8,
      );

      return {
        storeId: context.storeId,
        storeName: snapshot.storeName,
        computedAt,
        pricingHealthScore,
        scores,
        criticalIssueCount,
        revenueOpportunity,
        profitOpportunity,
        storeTotals: {
          activeProducts: snapshot.activeProducts.length,
          totalInventoryUnits: snapshot.totalInventoryUnits,
          totalRevenue30,
          totalRevenue90: snapshot.totalRevenue90,
          totalOrders30: snapshot.totalOrders30,
          refundRate:
            totalRevenue30 <= 0
              ? 0
              : Number(((snapshot.refundAmount30 / totalRevenue30) * 100).toFixed(2)),
        },
        margin,
        discount,
        elasticity,
        psychology,
        premium,
        competition,
        inventory,
        revenue,
        profit,
        demand,
        conversion,
        bundle,
        risk,
        priceConsistency,
        strategySignals: {
          premiumCandidates,
          lossLeaderCandidates,
          bundleFirstCandidates,
          neverDiscountCandidates,
          gradualRaiseCandidates,
          immediateRaiseCandidates,
          priceSensitiveProducts: snapshot.activeProducts.filter((product) => product.averageDiscountPercent > 15)
            .length,
        },
        merchantPricingPreferences: {
          prefersPremiumPositioning: premium.opportunityCount >= 2,
          avoidsDeepDiscounts: snapshot.averageDiscountPercent < 15,
          prefersBundlePricing: snapshot.bundleCandidateCount >= 2,
        },
        products: snapshot.activeProducts,
        implementedRecommendationIds: snapshot.implementedRecommendationIds,
        dismissedRecommendationIds: snapshot.dismissedRecommendationIds,
      };
    },
    fingerprint(facts: PricingIntelligenceFacts) {
      return buildFactFingerprint({
        storeId: facts.storeId,
        computedAt: facts.computedAt,
        pricingHealthScore: facts.pricingHealthScore,
        criticalIssueCount: facts.criticalIssueCount,
      });
    },
  };
}

export { buildPricingHealthExplanation };
