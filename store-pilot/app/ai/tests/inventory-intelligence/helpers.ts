import type { InventoryFacts } from "../../facts/inventory-facts";
import { createMockUnifiedStoreMetricsForFacts } from "../../migration/unified-metrics-migration";
import type { InventoryIntelligenceOutput } from "../../schemas/inventory-intelligence";

export function createMockInventoryProduct(
  overrides: Partial<{
    productId: string;
    title: string;
    inventory: number;
    sales30Days: number;
  }> = {},
) {
  return {
    productId: overrides.productId ?? "product-1",
    title: overrides.title ?? "Blue Hoodie",
    sku: "BH-001",
    inventory: overrides.inventory ?? 12,
    reservedInventory: 0,
    unitCost: 29,
    updatedAt: "2026-06-01T00:00:00.000Z",
    salesByDay: Array.from({ length: 10 }, (_, index) => ({
      day: `2026-06-${String(index + 11).padStart(2, "0")}`,
      quantity: 4,
      revenue: 0,
      orderCount: 0,
    })),
  };
}

export function createMockInventorySnapshot(
  products = [createMockInventoryProduct()],
) {
  return {
    products,
    unifiedMetrics: createMockUnifiedStoreMetricsForFacts(),
  };
}

export function buildInventoryFactsFromSnapshot(
  snapshot = createMockInventoryProduct(),
  storeId = "store-1",
): InventoryFacts {
  const sales30Days = snapshot.salesByDay.reduce((total, day) => total + day.quantity, 0);

  return {
    storeId,
    computedAt: "2026-06-20T10:00:00.000Z",
    inventoryHealthScore: 72,
    totalProducts: 1,
    totalInventoryUnits: snapshot.inventory,
    deadStockCount: 0,
    stockoutAlertCount: 1,
    overstockCount: 0,
    understockCount: 1,
    averageDaysRemaining: 12,
    averageWeeksOfCover: 1.7,
    averageTurnover: 1.2,
    averageSellThroughRate: 0.77,
    capitalLockedInInventory: snapshot.inventory * snapshot.unitCost,
    fastMoverCount: 1,
    slowMoverCount: 0,
    abcDistribution: [
      { label: "A", value: 1 },
      { label: "B", value: 0 },
      { label: "C", value: 0 },
    ],
    xyzDistribution: [
      { label: "X", value: 0 },
      { label: "Y", value: 1 },
      { label: "Z", value: 0 },
    ],
    products: [
      {
        productId: snapshot.productId,
        title: snapshot.title,
        sku: snapshot.sku,
        inventory: snapshot.inventory,
        availableInventory: snapshot.inventory,
        sales30Days,
        sales90Days: sales30Days,
        velocity: sales30Days / 30,
        turnover: 1.2,
        daysRemaining: 12,
        weeksOfCover: 1.7,
        agingDays: 10,
        overstockRisk: false,
        understockRisk: true,
        stockRisk: "HIGH",
        stockoutPredictionDate: "2026-07-02T10:00:00.000Z",
        reorderUrgency: 2,
        deadStock: false,
        safetyStock: 14,
        runOutDate: "2026-07-02T10:00:00.000Z",
        unitCost: snapshot.unitCost,
        sellThroughRate: 0.77,
        abcClass: "A",
        xyzClass: "Y",
        inventoryRiskScore: 55,
        leadTimeDays: 14,
        capitalLocked: snapshot.inventory * snapshot.unitCost,
      },
    ],
    stockAlerts: [
      {
        id: "stockout:product-1",
        productId: snapshot.productId,
        title: snapshot.title,
        severity: "high",
        detail: "Projected stockout in 12 days at 0.3 units/day",
      },
    ],
    reorderSuggestions: [
      {
        productId: snapshot.productId,
        title: snapshot.title,
        suggestedQuantity: 20,
        urgency: 2,
      },
    ],
    overstockProducts: [],
    understockProducts: [
      {
        productId: snapshot.productId,
        title: snapshot.title,
        detail: "12 days remaining with 0.3 units/day velocity",
      },
    ],
    deadInventory: [],
  };
}

export function buildValidInventoryIntelligenceDraft(
  facts: Pick<InventoryFacts, "inventoryHealthScore">,
): InventoryIntelligenceOutput {
  return {
    summary: "Store inventory health is pressured by one high-risk SKU.",
    priority: 2,
    confidence: 0.9,
    inventoryHealthScore: facts.inventoryHealthScore,
    findings: [
      {
        id: "understock-blue-hoodie",
        category: "Stockout",
        title: "Blue Hoodie is nearing stockout",
        detail: "Coverage is down to about 12 days at current velocity.",
        severity: "high",
        confidence: 0.92,
      },
    ],
    recommendations: [
      {
        id: "reorder:product-1",
        category: "Reorder",
        title: "Reorder Blue Hoodie before projected stockout",
        reason: "Blue Hoodie has only 12 days of inventory remaining at the current sales velocity.",
        evidenceKeys: ["stockout_alerts", "product_product-1_days_remaining", "product_product-1_velocity"],
        merchantAction: ["Place a replenishment order for 20 units with the primary supplier"],
        estimatedDifficulty: "Easy",
        confidence: 0.94,
        expectedResult: "Restore healthy inventory coverage within two weeks",
        potentialRisk: "Capital is tied up if demand softens suddenly",
        estimatedTime: "1-2 weeks",
        businessImpact: "Protect order fulfillment during sustained demand",
      },
      {
        id: "clearance:product-2",
        category: "Clearance",
        title: "Clear slow-moving warehouse units through a targeted offer",
        reason: "One SKU shows stale inventory patterns that tie up warehouse space.",
        evidenceKeys: ["dead_stock_count", "average_turnover", "total_inventory_units"],
        merchantAction: ["Launch a limited clearance offer on the slowest-moving SKU"],
        estimatedDifficulty: "Medium",
        confidence: 0.86,
        expectedResult: "Reduce dead inventory exposure over the next 30 days",
        potentialRisk: "Margin compression if the offer is too aggressive",
        estimatedTime: "2-3 weeks",
        businessImpact: "Improve cash flow by freeing tied-up inventory units",
      },
    ],
    stockAlerts: [
      {
        id: "stockout:product-1",
        productId: "product-1",
        title: "Blue Hoodie",
        severity: "high",
        detail: "Projected stockout in 12 days",
      },
    ],
    reorderSuggestions: [
      {
        productId: "product-1",
        title: "Blue Hoodie",
        suggestedQuantity: 20,
        urgency: 2,
      },
    ],
    overstockProducts: [],
    understockProducts: [
      {
        productId: "product-1",
        title: "Blue Hoodie",
        detail: "12 days remaining",
      },
    ],
    deadInventory: [],
    opportunities: ["Replenish high-velocity SKUs before stockouts"],
    risks: ["Stockouts on Blue Hoodie within two weeks"],
  };
}
