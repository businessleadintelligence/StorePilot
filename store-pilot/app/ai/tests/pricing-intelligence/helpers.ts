import {
  createPricingIntelligenceFactsBuilder,
  type PricingIntelligenceFacts,
  type PricingProductSnapshot,
} from "../../facts/pricing-intelligence-facts";
import { createMockUnifiedStoreMetricsForFacts } from "../../migration/unified-metrics-migration";
import type { PricingIntelligenceOutput } from "../../schemas/pricing-intelligence";
import type { PricingIntelligenceScores } from "../../tools/pricing-score-tool";

export function buildMockPricingScores(overrides: Partial<PricingIntelligenceScores> = {}): PricingIntelligenceScores {
  return {
    pricingHealthScore: 68,
    marginPercent: 38,
    averageDiscountPercent: 18,
    discountFrequency: 42,
    revenue: 12500,
    grossProfit: 5250,
    inventoryCost: 3200,
    inventoryCoverage: 8,
    revenuePerVisitor: 2.6,
    conversionRate: 0.028,
    aov: 62,
    pricePositionScore: 72,
    markdownPercent: 12,
    sellThrough: 45,
    profitTrend: -4,
    velocity: 2.4,
    inventoryRisk: 38,
    bundlePriceOpportunity: 55,
    premiumPricingOpportunity: 62,
    psychologicalPricingOpportunity: 48,
    priceConsistencyScore: 74,
    discountDependence: 42,
    revenueRisk: 22,
    profitRisk: 28,
    ...overrides,
  };
}

function defaultProducts(): PricingProductSnapshot[] {
  return [
    {
      productId: "p1",
      title: "Classic Tee",
      price: 29.99,
      inventory: 40,
      unitsSold30: 12,
      unitsSold90: 36,
      averageDiscountPercent: 8,
      velocity: 3,
    },
    {
      productId: "p2",
      title: "Premium Hoodie",
      price: 79.99,
      inventory: 15,
      unitsSold30: 8,
      unitsSold90: 24,
      averageDiscountPercent: 2,
      velocity: 2,
    },
    {
      productId: "p3",
      title: "Everyday Cap",
      price: 19.99,
      inventory: 55,
      unitsSold30: 3,
      unitsSold90: 9,
      averageDiscountPercent: 22,
      velocity: 0.75,
    },
    {
      productId: "p4",
      title: "Trail Jacket",
      price: 129.99,
      inventory: 22,
      unitsSold30: 6,
      unitsSold90: 18,
      averageDiscountPercent: 5,
      velocity: 1.5,
    },
    {
      productId: "p5",
      title: "Studio Tote",
      price: 44.99,
      inventory: 30,
      unitsSold30: 5,
      unitsSold90: 15,
      averageDiscountPercent: 15,
      velocity: 1.25,
    },
    {
      productId: "p6",
      title: "Weekend Shorts",
      price: 34.99,
      inventory: 18,
      unitsSold30: 10,
      unitsSold90: 30,
      averageDiscountPercent: 4,
      velocity: 2.5,
    },
  ];
}

export function createMockPricingIntelligenceSnapshot(
  overrides: Partial<{
    storeName: string;
    averageDiscountPercent: number;
    discountedOrderCount: number;
    totalOrders30: number;
    slowMoverCount: number;
    fastMoverCount: number;
    activeProducts: PricingProductSnapshot[];
    implementedRecommendationIds: string[];
    dismissedRecommendationIds: string[];
  }> = {},
) {
  const activeProducts = overrides.activeProducts ?? defaultProducts();
  const totalOrders30 = overrides.totalOrders30 ?? 48;
  const discountedOrderCount = overrides.discountedOrderCount ?? 20;

  return {
    storeName: overrides.storeName ?? "Acme Outfitters",
    estimatedCostRatio: 0.58,
    activeProducts,
    totalRevenue30: 12500,
    totalRevenue90: 34200,
    previousRevenue30: 13200,
    totalOrders30,
    totalOrders90: 132,
    discountedOrderCount,
    averageDiscountPercent: overrides.averageDiscountPercent ?? 18,
    markdownLineItems: 14,
    totalLineItems: 96,
    totalUnitsSold30: activeProducts.reduce((sum, product) => sum + product.unitsSold30, 0),
    totalInventoryUnits: activeProducts.reduce((sum, product) => sum + product.inventory, 0),
    refundAmount30: 320,
    bundleCandidateCount: 2,
    attachRateProxy: 0.28,
    slowMoverCount: overrides.slowMoverCount ?? 2,
    fastMoverCount: overrides.fastMoverCount ?? 3,
    averageWeeksOfCover: 9.5,
    implementedRecommendationIds: overrides.implementedRecommendationIds ?? [],
    dismissedRecommendationIds: overrides.dismissedRecommendationIds ?? [],
    unifiedMetrics: createMockUnifiedStoreMetricsForFacts(),
  };
}

export async function buildPricingIntelligenceFactsFromSnapshot(
  snapshot = createMockPricingIntelligenceSnapshot(),
  storeId = "store-1",
): Promise<PricingIntelligenceFacts> {
  const builder = createPricingIntelligenceFactsBuilder({
    async getPricingIntelligenceSnapshot() {
      return snapshot;
    },
  });

  return builder.build({ storeId, agentId: "pricing_intelligence" });
}

export function buildValidPricingIntelligenceDraft(
  facts: Pick<PricingIntelligenceFacts, "pricingHealthScore">,
): PricingIntelligenceOutput {
  return {
    summary:
      "Pricing health is mixed: discount dependence is limiting margin recovery while premium and bundle opportunities remain underused.",
    priority: 2,
    confidence: 0.86,
    pricingHealthScore: facts.pricingHealthScore,
    findings: [
      {
        id: "pricing-discount-dependence",
        category: "Discount Optimization",
        title: "Discount frequency is eroding pricing discipline",
        detail: "A meaningful share of recent orders relied on discounts, weakening full-price conversion.",
        severity: "high",
        confidence: 0.88,
      },
      {
        id: "pricing-premium-gap",
        category: "Premium Pricing",
        title: "Strong-demand products can support premium positioning",
        detail: "High-velocity products with low discounting show room for selective price increases.",
        severity: "medium",
        confidence: 0.84,
      },
    ],
    recommendations: [
      {
        id: "pricing:discount-discipline",
        category: "Discount Optimization",
        title: "Reduce blanket discounting on full-price best sellers",
        reason:
          "Discount dependence is elevated and is compressing margin on products that already convert without deep promotions.",
        evidenceKeys: ["discount_dependence", "average_discount_percent", "pricing_health_score"],
        merchantAction: [
          "Pause storewide codes on top-selling products with low discount history",
          "Replace broad discounts with targeted offers on slow movers only",
        ],
        expectedResult: "Lower discount dependence while protecting conversion on core products",
        estimatedImpact: "Recover margin on high-velocity SKUs within one pricing cycle",
        difficulty: "Medium",
        priority: 2,
        confidence: 0.89,
        verificationCriteria: "Discount dependence decreases after promotion changes",
        timeline: "2-3 weeks",
      },
      {
        id: "pricing:premium-raise",
        category: "Premium Pricing",
        title: "Raise prices on premium-positioning candidates",
        reason:
          "Several products show strong velocity with minimal discounting, indicating pricing power for selective premium positioning.",
        evidenceKeys: ["premium_candidates", "premium_opportunity", "margin_percent"],
        merchantAction: [
          "Increase prices 5-8% on top premium candidates with stable conversion",
          "Monitor conversion for two weeks before expanding the increase",
        ],
        expectedResult: "Improve gross margin without sacrificing demand on hero products",
        estimatedImpact: "Lift margin on premium candidates within 30 days",
        difficulty: "Easy",
        priority: 2,
        confidence: 0.87,
        verificationCriteria: "Margin percent improves after price increases publish",
        timeline: "2 weeks",
      },
    ],
    risks: ["Continued discount dependence may erode full-price demand"],
    opportunities: ["Premium and bundle pricing can unlock margin without broad promotions"],
    pricingInsights: ["Discount depth is doing more work than pricing architecture"],
    profitInsights: ["Margin recovery is available on products with strong organic demand"],
  };
}
