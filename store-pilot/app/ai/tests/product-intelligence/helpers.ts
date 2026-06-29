import type { ProductFacts } from "../../facts/product-facts";
import { createMockUnifiedStoreMetricsForFacts } from "../../migration/unified-metrics-migration";
import {
  buildInventoryMetrics,
  buildRefundMetrics,
  calculateDaysRemaining,
  calculateProductHealthScore,
  calculateSalesWindowMetrics,
  calculateTrend,
  calculateVelocity,
} from "../../tools";
import type { ProductIntelligenceOutput } from "../../schemas/product-intelligence";

export function createMockProductSnapshot(
  overrides: Partial<{
    productId: string;
    inventory: number;
    sales30Days: number;
    refundCount30Days: number;
  }> = {},
) {
  return {
    productId: overrides.productId ?? "product-1",
    shopifyProductId: "gid://shopify/Product/1",
    shopifyVariantId: "gid://shopify/ProductVariant/1",
    title: "Blue Hoodie",
    vendor: "StorePilot",
    category: "Apparel",
    status: "active",
    inventory: overrides.inventory ?? 120,
    reservedInventory: 20,
    margin: 27,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-15T00:00:00.000Z",
    salesByDay: [
      { day: "2026-06-20", quantity: 10, revenue: 500, orderCount: 8 },
      { day: "2026-06-19", quantity: 7, revenue: 350, orderCount: 6 },
      { day: "2026-06-10", quantity: 3, revenue: 150, orderCount: 2 },
    ],
    refundCount30Days: overrides.refundCount30Days ?? 1,
    unifiedMetrics: createMockUnifiedStoreMetricsForFacts(),
  };
}

export function buildValidProductIntelligenceDraft(
  facts: Pick<ProductFacts, "healthScore" | "title" | "daysRemaining" | "stockRisk">,
): ProductIntelligenceOutput {
  const daysRemaining = facts.daysRemaining ?? 168;
  const evidenceKeys =
    facts.stockRisk === "CRITICAL" || facts.stockRisk === "HIGH"
      ? ["sales_velocity", "inventory_days", "refund_rate"]
      : ["sales_30d", "inventory_days", "health_score"];

  return {
    summary: `${facts.title} shows steady demand with a computed health score of ${facts.healthScore}.`,
    priority: 2,
    confidence: 0.91,
    healthScore: facts.healthScore,
    findings: [
      {
        id: "inventory-runway",
        category: "Inventory",
        title: "Inventory runway needs attention",
        detail: `Inventory will last about ${daysRemaining} days at current sales velocity.`,
        severity: "medium",
        confidence: 0.9,
      },
    ],
    recommendations: [
      {
        id: "inventory-replenishment-plan",
        category: "Inventory",
        title: `Increase inventory for ${facts.title}`,
        reason: `Sales velocity increased while inventory decreased to ${daysRemaining} days.`,
        evidenceKeys,
        merchantAction: ["Order 300 additional units from primary supplier"],
        difficulty: "Easy",
        confidence: 0.96,
        expectedResult: "Restore healthy inventory coverage within two weeks",
        potentialRisk: "Capital is tied up if demand softens suddenly",
        estimatedTime: "1-2 weeks",
        businessImpact: "Protect revenue during sustained demand",
      },
      {
        id: "bundle-best-seller",
        category: "Merchandising",
        title: `Create a bundle featuring ${facts.title}`,
        reason: "Pairing with a high-velocity SKU can increase sell-through without discounting.",
        evidenceKeys: ["sales_trend", "sales_30d", "revenue_30d"],
        merchantAction: ["Create a bundle with your top-selling hoodie"],
        difficulty: "Easy",
        confidence: 0.88,
        expectedResult: "Lift units sold through bundled merchandising",
        potentialRisk: "Bundle margin mix may shift if paired product is discounted",
        estimatedTime: "3-5 days",
        businessImpact: "Increase average order value and sell-through",
      },
    ],
    opportunities: ["Bundle with best sellers to increase sell-through"],
    risks: ["Overstock if velocity drops during the next 30 days"],
  };
}

export function buildFactsWithHealthScore(
  snapshot = createMockProductSnapshot(),
  storeId = "store-1",
): ProductFacts {
  const sales = calculateSalesWindowMetrics({ quantitiesByDay: snapshot.salesByDay });
  const velocity = calculateVelocity(sales.sales30Days);
  const inventory = buildInventoryMetrics({
    inventory: snapshot.inventory,
    reservedInventory: snapshot.reservedInventory,
    daysRemaining: calculateDaysRemaining(
      snapshot.inventory === null
        ? null
        : Math.max(0, snapshot.inventory - (snapshot.reservedInventory ?? 0)),
      velocity,
    ),
    velocity,
  });
  const refunds = buildRefundMetrics({
    refundCount30Days: snapshot.refundCount30Days,
    orders30Days: sales.orders30Days,
  });
  const trend = calculateTrend(sales.sales7Days, sales.sales30Days);

  return {
    storeId,
    productId: snapshot.productId,
    shopifyProductId: snapshot.shopifyProductId,
    shopifyVariantId: snapshot.shopifyVariantId,
    title: snapshot.title,
    vendor: snapshot.vendor,
    category: snapshot.category,
    status: snapshot.status,
    inventory: inventory.inventory,
    availableInventory: inventory.availableInventory,
    reservedInventory: inventory.reservedInventory,
    sales7Days: sales.sales7Days,
    sales30Days: sales.sales30Days,
    sales90Days: sales.sales90Days,
    revenue30Days: sales.revenue30Days,
    orders30Days: sales.orders30Days,
    refundCount30Days: refunds.refundCount30Days,
    refundRate: refunds.refundRate,
    velocity,
    daysRemaining: calculateDaysRemaining(inventory.availableInventory, velocity),
    trend,
    stockRisk: inventory.stockRisk,
    margin: snapshot.margin,
    healthScore: calculateProductHealthScore({
      stockRisk: inventory.stockRisk,
      trend,
      refundRate: refunds.refundRate,
      sales30Days: sales.sales30Days,
      margin: snapshot.margin,
    }),
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
    computedAt: new Date().toISOString(),
  };
}

export function buildValidProductIntelligenceOutput(
  facts: Pick<ProductFacts, "healthScore" | "title" | "daysRemaining" | "stockRisk">,
): ProductIntelligenceOutput {
  return buildValidProductIntelligenceDraft(facts);
}
