import { buildFactFingerprint } from "../cache/fingerprint";
import { analyzeAovGrowth } from "../tools/aov-growth-tool";
import { analyzeCampaignReadiness } from "../tools/campaign-readiness-tool";
import { analyzeCollectionGrowth } from "../tools/collection-growth-tool";
import { analyzeCrossSellOpportunity } from "../tools/cross-sell-tool";
import { analyzeCustomerRetention } from "../tools/customer-retention-tool";
import { analyzeGrowthCapacity } from "../tools/growth-capacity-tool";
import { forecastGrowthRate } from "../tools/growth-forecast-tool";
import {
  buildGrowthHealthExplanation,
  calculateGrowthIntelligenceHealthScore,
} from "../tools/growth-health-tool";
import { analyzeGrowthOpportunity } from "../tools/growth-opportunity-tool";
import { analyzeGrowthRisk } from "../tools/growth-risk-tool";
import { analyzeGrowthSeasonality } from "../tools/growth-seasonality-tool";
import {
  calculateGrowthIntelligenceScores,
  type GrowthIntelligenceScores,
} from "../tools/growth-score-tool";
import { analyzeLandingPageGrowth } from "../tools/landing-page-growth-tool";
import { analyzeMerchandising } from "../tools/merchandising-tool";
import { analyzeRepeatPurchases } from "../tools/repeat-purchase-tool";
import { analyzeRevenueGrowth } from "../tools/revenue-growth-tool";
import { analyzeUpsellOpportunity } from "../tools/upsell-tool";
import type { FactBuilder, FactBuilderContext } from "./types";

export type GrowthProductSnapshot = {
  productId: string;
  title: string;
  price: number;
  inventory: number;
  unitsSold30: number;
  velocity: number;
};

export type GrowthAgentSnapshot = {
  agentId: string;
  summary: string | null;
  confidence: number | null;
  healthScore: number | null;
  riskScore: number;
  opportunityCount: number;
  createdAt: string;
};

export type GrowthIntelligenceFacts = {
  storeId: string;
  storeName: string;
  computedAt: string;
  growthHealthScore: number;
  growthScore: number;
  revenueOpportunity: number;
  aovOpportunity: number;
  scores: GrowthIntelligenceScores;
  criticalIssueCount: number;
  storeTotals: {
    activeProducts: number;
    totalInventoryUnits: number;
    totalRevenue30: number;
    totalRevenue90: number;
    totalOrders30: number;
    totalOrders90: number;
    refundRate: number;
    returningCustomerRate: number;
  };
  revenue: ReturnType<typeof analyzeRevenueGrowth>;
  aov: ReturnType<typeof analyzeAovGrowth>;
  repeatPurchases: ReturnType<typeof analyzeRepeatPurchases>;
  retention: ReturnType<typeof analyzeCustomerRetention>;
  upsell: ReturnType<typeof analyzeUpsellOpportunity>;
  crossSell: ReturnType<typeof analyzeCrossSellOpportunity>;
  collections: ReturnType<typeof analyzeCollectionGrowth>;
  campaigns: ReturnType<typeof analyzeCampaignReadiness>;
  landingPages: ReturnType<typeof analyzeLandingPageGrowth>;
  merchandising: ReturnType<typeof analyzeMerchandising>;
  risk: ReturnType<typeof analyzeGrowthRisk>;
  opportunity: ReturnType<typeof analyzeGrowthOpportunity>;
  capacity: ReturnType<typeof analyzeGrowthCapacity>;
  seasonality: ReturnType<typeof analyzeGrowthSeasonality>;
  forecast: ReturnType<typeof forecastGrowthRate>;
  strategySignals: {
    aovLiftCandidates: number;
    retentionRiskProducts: number;
    upsellCandidates: number;
    crossSellPairs: number;
    collectionExpansionCandidates: number;
    campaignReadySegments: number;
    landingPageFixes: number;
    merchandisingGaps: number;
    seasonalPeaks: number;
    repeatPurchaseDrivers: number;
    immediateWinCount: number;
    strategicOpportunityCount: number;
  };
  merchantGrowthPreferences: {
    prefersAovGrowth: boolean;
    prefersRetentionFirst: boolean;
    prefersCampaignPush: boolean;
  };
  agentSnapshots: GrowthAgentSnapshot[];
  products: GrowthProductSnapshot[];
  implementedRecommendationIds: string[];
  dismissedRecommendationIds: string[];
};

export type GrowthIntelligenceFactsSource = {
  getGrowthIntelligenceSnapshot(input: { storeId: string }): Promise<{
    storeName: string;
    estimatedCostRatio: number;
    estimatedMarginPercent: number;
    activeProducts: GrowthProductSnapshot[];
    totalRevenue30: number;
    totalRevenue90: number;
    previousRevenue30: number;
    totalOrders30: number;
    totalOrders90: number;
    aov30: number;
    previousAov30: number;
    itemsPerOrder: number;
    refundAmount30: number;
    returningCustomerRate: number;
    repeatProductCount: number;
    totalProductsSold: number;
    repeatOrderCount: number;
    lowBasketDepthOrders: number;
    multiItemOrderRate: number;
    attachRateProxy: number;
    bundleCandidateCount: number;
    complementaryPairCount: number;
    collectionCount: number;
    productsPerCollection: number;
    thinCollectionCount: number;
    missingCollectionDescriptions: number;
    slowMoverCount: number;
    fastMoverCount: number;
    heroProductCount: number;
    premiumProductCount: number;
    productsAboveMedian: number;
    medianPrice: number;
    totalInventoryUnits: number;
    totalUnitsSold30: number;
    outOfStockProducts: number;
    lowStockProducts: number;
    openGrowthRecommendations: number;
    implementedRecommendationCount: number;
    implementedRecommendationIds: string[];
    dismissedRecommendationIds: string[];
    salesByMonth: Array<{ month: number; quantity: number }>;
    agentSnapshots: GrowthAgentSnapshot[];
    persistedSignals: {
      productHealthScore: number | null;
      inventoryHealthScore: number | null;
      bundleOpportunityCount: number;
      storeAuditScore: number | null;
      seoHealthScore: number | null;
      pricingHealthScore: number | null;
      inventoryRiskScore: number;
      pricingRiskScore: number;
      conversionIssueCount: number;
      mobileUxIssueCount: number;
      homepageIssueCount: number;
      productPageIssueCount: number;
    };
  } | null>;
};

function countCriticalIssues(sections: Array<{ issues: string[] }>): number {
  return sections.reduce((total, section) => total + section.issues.length, 0);
}

export function createGrowthIntelligenceFactsBuilder(
  source: GrowthIntelligenceFactsSource,
): FactBuilder<GrowthIntelligenceFacts> {
  return {
    agentId: "growth_intelligence",
    async build(context: FactBuilderContext): Promise<GrowthIntelligenceFacts> {
      const snapshot = await source.getGrowthIntelligenceSnapshot({ storeId: context.storeId });
      if (!snapshot) {
        throw new Error("growth_intelligence_facts_unavailable");
      }

      const computedAt = new Date().toISOString();
      const refundRate =
        snapshot.totalRevenue30 <= 0
          ? 0
          : Number(((snapshot.refundAmount30 / snapshot.totalRevenue30) * 100).toFixed(2));

      const revenue = analyzeRevenueGrowth({
        totalRevenue30: snapshot.totalRevenue30,
        previousRevenue30: snapshot.previousRevenue30,
        totalRevenue90: snapshot.totalRevenue90,
      });
      const aov = analyzeAovGrowth({
        aov30: snapshot.aov30,
        previousAov30: snapshot.previousAov30,
        itemsPerOrder: snapshot.itemsPerOrder,
      });
      const repeatPurchases = analyzeRepeatPurchases({
        repeatProductCount: snapshot.repeatProductCount,
        totalProductsSold: snapshot.totalProductsSold,
        repeatOrderCount: snapshot.repeatOrderCount,
        totalOrders: snapshot.totalOrders90,
      });
      const retention = analyzeCustomerRetention({
        returningCustomerRate: snapshot.returningCustomerRate,
        refundRate,
        repeatPurchaseRate: repeatPurchases.repeatPurchaseRate,
      });
      const upsell = analyzeUpsellOpportunity({
        highVelocityProducts: snapshot.fastMoverCount,
        lowBasketDepthOrders: snapshot.lowBasketDepthOrders,
        totalOrders: snapshot.totalOrders30,
        premiumProductCount: snapshot.premiumProductCount,
        medianPrice: snapshot.medianPrice,
        productsAboveMedian: snapshot.productsAboveMedian,
      });
      const crossSell = analyzeCrossSellOpportunity({
        attachRateProxy: snapshot.attachRateProxy,
        bundleCandidateCount: snapshot.bundleCandidateCount,
        complementaryPairCount: snapshot.complementaryPairCount,
        multiItemOrderRate: snapshot.multiItemOrderRate,
      });
      const collections = analyzeCollectionGrowth({
        collectionCount: snapshot.collectionCount,
        activeProducts: snapshot.activeProducts.length,
        productsPerCollection: snapshot.productsPerCollection,
        thinCollectionCount: snapshot.thinCollectionCount,
        missingCollectionDescriptions: snapshot.missingCollectionDescriptions,
      });
      const landingPages = analyzeLandingPageGrowth({
        storeAuditScore: snapshot.persistedSignals.storeAuditScore ?? 55,
        conversionIssueCount: snapshot.persistedSignals.conversionIssueCount,
        mobileUxIssueCount: snapshot.persistedSignals.mobileUxIssueCount,
        homepageIssueCount: snapshot.persistedSignals.homepageIssueCount,
        productPageIssueCount: snapshot.persistedSignals.productPageIssueCount,
      });
      const merchandising = analyzeMerchandising({
        activeProducts: snapshot.activeProducts.length,
        heroProductCount: snapshot.heroProductCount,
        slowMoverCount: snapshot.slowMoverCount,
        fastMoverCount: snapshot.fastMoverCount,
        collectionCount: snapshot.collectionCount,
        bundleOpportunityCount: snapshot.persistedSignals.bundleOpportunityCount,
      });
      const seasonality = analyzeGrowthSeasonality({
        salesByMonth: snapshot.salesByMonth,
      });
      const forecast = forecastGrowthRate({
        revenueGrowthRate: revenue.revenueGrowthRate,
        aovGrowthRate: aov.aovGrowthRate,
        repeatPurchaseRate: repeatPurchases.repeatPurchaseRate,
        seasonalStrength: seasonality.seasonalStrength,
        retentionScore: retention.retentionScore,
      });
      const risk = analyzeGrowthRisk({
        revenueGrowthRate: revenue.revenueGrowthRate,
        retentionScore: retention.retentionScore,
        growthRiskFromInventory: snapshot.persistedSignals.inventoryRiskScore,
        growthRiskFromPricing: snapshot.persistedSignals.pricingRiskScore,
        refundRate,
      });

      const inventoryCoverageScore =
        snapshot.activeProducts.length <= 0
          ? 0
          : Math.max(
              0,
              100 -
                Math.round(
                  ((snapshot.outOfStockProducts + snapshot.lowStockProducts) /
                    snapshot.activeProducts.length) *
                    100,
                ),
            );

      const preliminaryScores = calculateGrowthIntelligenceScores({
        revenue30: snapshot.totalRevenue30,
        revenue90: snapshot.totalRevenue90,
        revenueGrowthRate: revenue.revenueGrowthRate,
        aov: snapshot.aov30,
        aovGrowthRate: aov.aovGrowthRate,
        repeatPurchaseRate: repeatPurchases.repeatPurchaseRate,
        returningCustomerRate: snapshot.returningCustomerRate,
        retentionScore: retention.retentionScore,
        upsellOpportunity: upsell.upsellOpportunity,
        crossSellOpportunity: crossSell.crossSellOpportunity,
        collectionGrowthScore: collections.collectionGrowthScore,
        campaignReadinessScore: 50,
        landingPageGrowthScore: landingPages.landingPageGrowthScore,
        merchandisingScore: merchandising.merchandisingScore,
        growthRisk: risk.growthRisk,
        seasonalStrength: seasonality.seasonalStrength,
        forecastGrowthRate: forecast.forecastGrowthRate,
        capacityScore: 50,
        estimatedMarginPercent: snapshot.estimatedMarginPercent,
      });

      const campaigns = analyzeCampaignReadiness({
        growthScore: preliminaryScores.growthScore,
        inventoryCoverageScore,
        landingPageScore: landingPages.landingPageGrowthScore,
        seoScore: snapshot.persistedSignals.seoHealthScore ?? 50,
        outOfStockProducts: snapshot.outOfStockProducts,
        activeProducts: snapshot.activeProducts.length,
      });
      const capacity = analyzeGrowthCapacity({
        activeProducts: snapshot.activeProducts.length,
        outOfStockProducts: snapshot.outOfStockProducts,
        lowStockProducts: snapshot.lowStockProducts,
        openGrowthRecommendations: snapshot.openGrowthRecommendations,
        implementedRecommendationCount: snapshot.implementedRecommendationCount,
      });

      const scores = calculateGrowthIntelligenceScores({
        revenue30: snapshot.totalRevenue30,
        revenue90: snapshot.totalRevenue90,
        revenueGrowthRate: revenue.revenueGrowthRate,
        aov: snapshot.aov30,
        aovGrowthRate: aov.aovGrowthRate,
        repeatPurchaseRate: repeatPurchases.repeatPurchaseRate,
        returningCustomerRate: snapshot.returningCustomerRate,
        retentionScore: retention.retentionScore,
        upsellOpportunity: upsell.upsellOpportunity,
        crossSellOpportunity: crossSell.crossSellOpportunity,
        collectionGrowthScore: collections.collectionGrowthScore,
        campaignReadinessScore: campaigns.campaignReadinessScore,
        landingPageGrowthScore: landingPages.landingPageGrowthScore,
        merchandisingScore: merchandising.merchandisingScore,
        growthRisk: risk.growthRisk,
        seasonalStrength: seasonality.seasonalStrength,
        forecastGrowthRate: forecast.forecastGrowthRate,
        capacityScore: capacity.capacityScore,
        estimatedMarginPercent: snapshot.estimatedMarginPercent,
      });

      const opportunity = analyzeGrowthOpportunity({
        revenueOpportunity: scores.revenueOpportunity,
        upsellOpportunity: upsell.upsellOpportunity,
        crossSellOpportunity: crossSell.crossSellOpportunity,
        retentionScore: retention.retentionScore,
        collectionGrowthScore: collections.collectionGrowthScore,
        campaignReadinessScore: campaigns.campaignReadinessScore,
      });

      const criticalIssueCount = countCriticalIssues([
        revenue,
        aov,
        repeatPurchases,
        retention,
        upsell,
        crossSell,
        collections,
        campaigns,
        landingPages,
        merchandising,
        risk,
        capacity,
        seasonality,
        forecast,
        opportunity,
      ]);

      const growthHealthScore = calculateGrowthIntelligenceHealthScore({
        scores,
        criticalIssueCount,
      });

      const revenueOpportunity = scores.revenueOpportunity;
      const aovOpportunity = scores.profitOpportunity;

      return {
        storeId: context.storeId,
        storeName: snapshot.storeName,
        computedAt,
        growthHealthScore,
        growthScore: scores.growthScore,
        revenueOpportunity,
        aovOpportunity,
        scores,
        criticalIssueCount,
        storeTotals: {
          activeProducts: snapshot.activeProducts.length,
          totalInventoryUnits: snapshot.totalInventoryUnits,
          totalRevenue30: snapshot.totalRevenue30,
          totalRevenue90: snapshot.totalRevenue90,
          totalOrders30: snapshot.totalOrders30,
          totalOrders90: snapshot.totalOrders90,
          refundRate,
          returningCustomerRate: snapshot.returningCustomerRate,
        },
        revenue,
        aov,
        repeatPurchases,
        retention,
        upsell,
        crossSell,
        collections,
        campaigns,
        landingPages,
        merchandising,
        risk,
        opportunity,
        capacity,
        seasonality,
        forecast,
        strategySignals: {
          aovLiftCandidates: upsell.candidateCount,
          retentionRiskProducts: snapshot.slowMoverCount,
          upsellCandidates: upsell.candidateCount,
          crossSellPairs: crossSell.pairCount,
          collectionExpansionCandidates: collections.expansionCandidates,
          campaignReadySegments: campaigns.readySegments,
          landingPageFixes: landingPages.fixCount,
          merchandisingGaps: merchandising.gapCount,
          seasonalPeaks: seasonality.signals.length,
          repeatPurchaseDrivers: repeatPurchases.repeatPurchaseRate >= 20 ? snapshot.repeatProductCount : 0,
          immediateWinCount: opportunity.immediateWinCount,
          strategicOpportunityCount: opportunity.strategicOpportunityCount,
        },
        merchantGrowthPreferences: {
          prefersAovGrowth: upsell.upsellOpportunity >= crossSell.crossSellOpportunity,
          prefersRetentionFirst: retention.retentionScore < 55,
          prefersCampaignPush: campaigns.campaignReadinessScore >= 65,
        },
        agentSnapshots: snapshot.agentSnapshots,
        products: snapshot.activeProducts,
        implementedRecommendationIds: snapshot.implementedRecommendationIds,
        dismissedRecommendationIds: snapshot.dismissedRecommendationIds,
      };
    },
    fingerprint(facts: GrowthIntelligenceFacts) {
      return buildFactFingerprint({
        storeId: facts.storeId,
        computedAt: facts.computedAt,
        growthHealthScore: facts.growthHealthScore,
        criticalIssueCount: facts.criticalIssueCount,
      });
    },
  };
}

export { buildGrowthHealthExplanation };
