import {
  createGrowthIntelligenceFactsBuilder,
  type GrowthIntelligenceFacts,
  type GrowthProductSnapshot,
} from "../../facts/growth-intelligence-facts";
import { createMockUnifiedStoreMetricsForFacts } from "../../migration/unified-metrics-migration";
import type { GrowthIntelligenceOutput } from "../../schemas/growth-intelligence";
import type { GrowthIntelligenceScores } from "../../tools/growth-score-tool";

export function buildMockGrowthScores(overrides: Partial<GrowthIntelligenceScores> = {}): GrowthIntelligenceScores {
  return {
    growthHealthScore: 68,
    growthScore: 72,
    revenue30: 12500,
    revenue90: 34200,
    revenueGrowthRate: 8,
    aov: 62,
    aovGrowthRate: 6,
    repeatPurchaseRate: 24,
    returningCustomerRate: 28,
    retentionScore: 58,
    upsellOpportunity: 62,
    crossSellOpportunity: 55,
    collectionGrowthScore: 64,
    campaignReadinessScore: 58,
    landingPageGrowthScore: 66,
    merchandisingScore: 60,
    growthRisk: 32,
    seasonalStrength: 0.4,
    forecastGrowthRate: 7,
    capacityScore: 70,
    revenueOpportunity: 18200,
    profitOpportunity: 8400,
    ...overrides,
  };
}

function defaultProducts(): GrowthProductSnapshot[] {
  return [
    {
      productId: "p1",
      title: "Classic Tee",
      price: 29.99,
      inventory: 40,
      unitsSold30: 12,
      velocity: 3,
    },
    {
      productId: "p2",
      title: "Premium Hoodie",
      price: 79.99,
      inventory: 15,
      unitsSold30: 8,
      velocity: 2,
    },
    {
      productId: "p3",
      title: "Everyday Cap",
      price: 19.99,
      inventory: 55,
      unitsSold30: 3,
      velocity: 0.75,
    },
    {
      productId: "p4",
      title: "Trail Jacket",
      price: 129.99,
      inventory: 22,
      unitsSold30: 6,
      velocity: 1.5,
    },
    {
      productId: "p5",
      title: "Studio Tote",
      price: 44.99,
      inventory: 30,
      unitsSold30: 5,
      velocity: 1.25,
    },
    {
      productId: "p6",
      title: "Weekend Shorts",
      price: 34.99,
      inventory: 18,
      unitsSold30: 10,
      velocity: 2.5,
    },
  ];
}

const defaultPersistedSignals = {
  productHealthScore: 72,
  inventoryHealthScore: 68,
  bundleOpportunityCount: 3,
  storeAuditScore: 74,
  seoHealthScore: 78,
  pricingHealthScore: 70,
  inventoryRiskScore: 35,
  pricingRiskScore: 28,
  conversionIssueCount: 1,
  mobileUxIssueCount: 0,
  homepageIssueCount: 1,
  productPageIssueCount: 0,
};

export function createMockGrowthIntelligenceSnapshot(
  overrides: Partial<{
    storeName: string;
    totalRevenue30: number;
    previousRevenue30: number;
    totalOrders30: number;
    returningCustomerRate: number;
    slowMoverCount: number;
    fastMoverCount: number;
    activeProducts: GrowthProductSnapshot[];
    implementedRecommendationIds: string[];
    dismissedRecommendationIds: string[];
    persistedSignals: typeof defaultPersistedSignals;
  }> = {},
) {
  const activeProducts = overrides.activeProducts ?? defaultProducts();
  const totalOrders30 = overrides.totalOrders30 ?? 48;
  const totalRevenue30 = overrides.totalRevenue30 ?? 12500;
  const previousRevenue30 = overrides.previousRevenue30 ?? 11000;

  return {
    storeName: overrides.storeName ?? "Acme Outfitters",
    estimatedCostRatio: 0.58,
    estimatedMarginPercent: 42,
    activeProducts,
    totalRevenue30,
    totalRevenue90: 34200,
    previousRevenue30,
    totalOrders30,
    totalOrders90: 132,
    aov30: totalOrders30 <= 0 ? 0 : Number((totalRevenue30 / totalOrders30).toFixed(2)),
    previousAov30: 58,
    itemsPerOrder: 1.8,
    refundAmount30: 320,
    returningCustomerRate: overrides.returningCustomerRate ?? 28,
    repeatProductCount: 5,
    totalProductsSold: 12,
    repeatOrderCount: 14,
    lowBasketDepthOrders: 18,
    multiItemOrderRate: 35,
    attachRateProxy: 0.28,
    bundleCandidateCount: 2,
    complementaryPairCount: 2,
    collectionCount: 4,
    productsPerCollection: 3,
    thinCollectionCount: 1,
    missingCollectionDescriptions: 2,
    slowMoverCount: overrides.slowMoverCount ?? 2,
    fastMoverCount: overrides.fastMoverCount ?? 3,
    heroProductCount: 3,
    premiumProductCount: 2,
    productsAboveMedian: 3,
    medianPrice: 34.99,
    totalInventoryUnits: activeProducts.reduce((sum, product) => sum + product.inventory, 0),
    totalUnitsSold30: activeProducts.reduce((sum, product) => sum + product.unitsSold30, 0),
    outOfStockProducts: 0,
    lowStockProducts: 1,
    openGrowthRecommendations: 0,
    implementedRecommendationCount: 0,
    implementedRecommendationIds: overrides.implementedRecommendationIds ?? [],
    dismissedRecommendationIds: overrides.dismissedRecommendationIds ?? [],
    salesByMonth: [{ month: 6, quantity: 44 }],
    agentSnapshots: [],
    persistedSignals: overrides.persistedSignals ?? defaultPersistedSignals,
    unifiedMetrics: createMockUnifiedStoreMetricsForFacts(),
  };
}

export async function buildGrowthIntelligenceFactsFromSnapshot(
  snapshot = createMockGrowthIntelligenceSnapshot(),
  storeId = "store-1",
): Promise<GrowthIntelligenceFacts> {
  const builder = createGrowthIntelligenceFactsBuilder({
    async getGrowthIntelligenceSnapshot() {
      return snapshot;
    },
  });

  return builder.build({ storeId, agentId: "growth_intelligence" });
}

export function buildValidGrowthIntelligenceDraft(
  facts: Pick<
    GrowthIntelligenceFacts,
    "growthScore" | "growthHealthScore" | "revenueOpportunity" | "aovOpportunity"
  >,
): GrowthIntelligenceOutput {
  return {
    summary:
      "Growth health is mixed: retention is limiting expansion while upsell and collection opportunities remain underused.",
    priority: 2,
    confidence: 0.86,
    growthHealthScore: facts.growthHealthScore,
    growthScore: facts.growthScore,
    growthStrategy:
      "Stabilize retention with win-back flows, then deploy upsell merchandising on hero products before scaling campaigns.",
    expectedRevenueLift: facts.revenueOpportunity,
    expectedProfitLift: facts.aovOpportunity,
    campaignSuggestions: [
      "Post-purchase upsell offer on top-selling SKUs",
      "Repeat buyer win-back campaign with replenishment reminder",
    ],
    findings: [
      {
        id: "growth-retention-gap",
        category: "Retention",
        title: "Retention is limiting repeat revenue expansion",
        detail: "Returning customer rate is below target for sustainable growth campaigns.",
        severity: "high",
        confidence: 0.88,
      },
      {
        id: "growth-upsell-gap",
        category: "Upsell",
        title: "High-velocity products support upsell campaigns",
        detail: "Hero products with strong velocity show room for basket expansion.",
        severity: "medium",
        confidence: 0.84,
      },
    ],
    recommendations: [
      {
        id: "growth:upsell-campaign",
        category: "Upsell",
        title: "Launch upsell campaign on hero products",
        reason:
          "Upsell opportunity is elevated and low basket depth suggests room to lift AOV without broad discounts.",
        evidenceKeys: ["upsell_opportunity", "growth_score", "aov"],
        merchantAction: [
          "Feature complementary products on hero PDPs",
          "Add post-purchase upsell offer for top sellers",
        ],
        expectedResult: "Increase average order value on high-traffic products",
        estimatedImpact: "Lift AOV on hero SKUs within one campaign cycle",
        difficulty: "Medium",
        priority: 2,
        confidence: 0.89,
        verificationCriteria: "AOV increases after upsell campaign launches",
        timeline: "2-3 weeks",
      },
      {
        id: "growth:retention-winback",
        category: "Retention",
        title: "Improve repeat purchase rate with targeted win-back",
        reason:
          "Retention score is soft and repeat purchase rate has room to improve with segmented follow-up.",
        evidenceKeys: ["retention_score", "repeat_purchase_rate", "growth_health_score"],
        merchantAction: [
          "Email repeat buyers with replenishment reminders",
          "Offer bundle incentive for second purchase within 30 days",
        ],
        expectedResult: "Improve repeat purchase rate without eroding margin",
        estimatedImpact: "Lift repeat revenue within 30 days",
        difficulty: "Easy",
        priority: 2,
        confidence: 0.87,
        verificationCriteria: "Repeat purchase rate improves after win-back campaign",
        timeline: "2 weeks",
      },
    ],
    risks: ["Weak retention may limit campaign ROI"],
    opportunities: ["Upsell and collection merchandising can unlock revenue without new traffic"],
    growthInsights: ["Basket depth is the main growth lever before scaling acquisition"],
    retentionInsights: ["Repeat purchase drivers are available on hero SKUs"],
  };
}
