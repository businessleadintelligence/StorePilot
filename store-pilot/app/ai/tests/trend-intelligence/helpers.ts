import type { TrendFacts } from "../../facts/trend-facts";
import type { TrendIntelligenceOutput } from "../../schemas/trend-intelligence";

function buildSalesByDay(baseQuantity: number, recentMultiplier: number) {
  return Array.from({ length: 30 }, (_, index) => {
    const day = `2026-06-${String(index + 1).padStart(2, "0")}`;
    const quantity = index >= 23 ? baseQuantity * recentMultiplier : baseQuantity;
    return { day, quantity, revenue: quantity * 25 };
  });
}

export function createMockTrendSnapshot() {
  return {
    products: [
      {
        productId: "product-1",
        title: "Blue Hoodie",
        inventory: 8,
        salesByDay: buildSalesByDay(2, 4),
        salesPrior30Days: 20,
      },
      {
        productId: "product-2",
        title: "Beanie Hat",
        inventory: 40,
        salesByDay: buildSalesByDay(3, 0.5),
        salesPrior30Days: 45,
      },
    ],
    storeRevenue7Days: 1200,
    storeRevenue30Days: 4200,
    storeRevenuePrior30Days: 3800,
    salesByMonth: [
      { month: 5, quantity: 40 },
      { month: 6, quantity: 72 },
    ],
    implementedRecommendationIds: [] as string[],
    dismissedRecommendationIds: [] as string[],
  };
}

export function buildTrendFactsFromSnapshot(
  snapshot = createMockTrendSnapshot(),
  storeId = "store-1",
): TrendFacts {
  return {
    storeId,
    computedAt: "2026-06-20T10:00:00.000Z",
    trendHealthScore: 72,
    trendScore: 68,
    trendDirection: "mixed",
    historicalSales: {
      total7Days: 42,
      total30Days: 120,
      total90Days: 120,
      revenue30Days: snapshot.storeRevenue30Days,
      byDay: [],
    },
    rollingGrowth: {
      storeGrowthRate: 10.5,
      shortTermGrowthRate: 15,
      mediumTermGrowthRate: 10.5,
    },
    rollingDecline: { decliningProductCount: 1, declineRate: 50 },
    velocityTrend: { averageVelocity: 2, velocityChange: 0.4 },
    categoryTrend: [
      {
        category: "Blue",
        direction: "emerging",
        growthRate: 25,
        momentum: 0.7,
        productCount: 1,
        sales30Days: 60,
      },
    ],
    inventoryTrend: { risingInventorySkus: 1, fallingInventorySkus: 1 },
    revenueTrend: {
      revenue7Days: snapshot.storeRevenue7Days,
      revenue30Days: snapshot.storeRevenue30Days,
      growthRate: 10.5,
    },
    seasonality: {
      peakMonth: 6,
      seasonalStrength: 1.8,
      signals: [{ label: "Peak demand in month 6", strength: 1.8, month: 6 }],
    },
    momentum: { emergingCount: 1, decliningCount: 1, averageMomentum: 0.55 },
    riskLevel: "medium",
    opportunityLevel: "medium",
    products: [
      {
        productId: "product-1",
        title: "Blue Hoodie",
        direction: "emerging",
        growthRate: 35,
        momentum: 0.72,
        sales7Days: 24,
        sales30Days: 48,
        velocity: 1.6,
      },
      {
        productId: "product-2",
        title: "Beanie Hat",
        direction: "declining",
        growthRate: -20,
        momentum: 0.18,
        sales7Days: 6,
        sales30Days: 36,
        velocity: 1.2,
      },
    ],
    emergingProductIds: ["product-1"],
    decliningProductIds: ["product-2"],
    seasonalSignals: [{ label: "Peak demand in month 6", strength: 1.8, month: 6 }],
    implementedRecommendationIds: [],
    dismissedRecommendationIds: [],
  };
}

export function buildValidTrendIntelligenceDraft(
  facts: Pick<
    TrendFacts,
    | "trendHealthScore"
    | "trendDirection"
    | "products"
    | "emergingProductIds"
    | "decliningProductIds"
    | "seasonalSignals"
  >,
): TrendIntelligenceOutput {
  const emerging = facts.products.find((product) => product.productId === "product-1");
  const declining = facts.products.find((product) => product.productId === "product-2");

  return {
    summary:
      "Blue Hoodie shows emerging demand while Beanie Hat is slowing, creating a mixed but actionable trend picture.",
    priority: 2,
    confidence: 0.88,
    trendHealthScore: facts.trendHealthScore,
    trendDirection: facts.trendDirection,
    findings: [
      {
        id: "trend-blue-hoodie-emerging",
        category: "Emerging Opportunity",
        title: "Blue Hoodie demand is accelerating",
        detail: "Recent weekly sales for Blue Hoodie are outpacing the 30-day baseline.",
        severity: "high",
        confidence: 0.9,
      },
      {
        id: "trend-beanie-declining",
        category: "Declining Demand",
        title: "Beanie Hat demand is slowing",
        detail: "Beanie Hat weekly sales have fallen below the prior 30-day baseline.",
        severity: "medium",
        confidence: 0.86,
      },
    ],
    recommendations: [
      {
        id: "trend:restock-blue-hoodie",
        category: "Emerging Opportunity",
        title: "Increase inventory for Blue Hoodie before demand outpaces supply",
        reason:
          "Blue Hoodie shows emerging momentum with recent weekly sales outpacing the 30-day baseline and low inventory coverage.",
        evidenceKeys: ["emerging_product_count", "product_product-1_momentum", "average_momentum"],
        merchantAction: [
          "Increase Blue Hoodie purchase order quantity for the next replenishment cycle",
          "Feature Blue Hoodie in homepage and collection merchandising",
        ],
        expectedResult: "Capture emerging hoodie demand before stockouts reduce conversion",
        estimatedImpact: "Protect revenue from an accelerating SKU",
        difficulty: "Easy",
        priority: 2,
        confidence: 0.91,
        verificationCriteria: "Blue Hoodie sales increase after inventory and merchandising updates",
        timeline: "1-2 weeks",
        productId: emerging?.productId ?? "product-1",
      },
      {
        id: "trend:discount-beanie",
        category: "Declining Demand",
        title: "Run a targeted Beanie Hat recovery offer",
        reason:
          "Beanie Hat is declining against prior demand, leaving excess inventory at risk of dead stock.",
        evidenceKeys: ["declining_product_count", "trend_direction", "risk_level"],
        merchantAction: [
          "Launch a limited-time Beanie Hat discount to recover velocity",
          "Bundle Beanie Hat with Blue Hoodie to move remaining units",
        ],
        expectedResult: "Stabilize Beanie Hat sales and reduce excess inventory",
        estimatedImpact: "Recover slowing SKU demand before inventory locks capital",
        difficulty: "Medium",
        priority: 2,
        confidence: 0.84,
        verificationCriteria: "Beanie Hat sales stabilize or improve within 21 days",
        timeline: "2-3 weeks",
        productId: declining?.productId ?? "product-2",
      },
    ],
    risks: ["Beanie Hat may become dead stock if decline continues"],
    opportunities: ["Blue Hoodie can capture incremental revenue with replenishment"],
    emergingProducts: facts.products
      .filter((product) => facts.emergingProductIds.includes(product.productId))
      .map((product) => ({
        productId: product.productId,
        title: product.title,
        direction: product.direction,
        growthRate: product.growthRate,
        momentum: product.momentum,
        sales30Days: product.sales30Days,
      })),
    decliningProducts: facts.products
      .filter((product) => facts.decliningProductIds.includes(product.productId))
      .map((product) => ({
        productId: product.productId,
        title: product.title,
        direction: product.direction,
        growthRate: product.growthRate,
        momentum: product.momentum,
        sales30Days: product.sales30Days,
      })),
    seasonalSignals: facts.seasonalSignals.map((signal) => ({
      label: signal.label,
      strength: signal.strength,
      month: signal.month,
    })),
  };
}
