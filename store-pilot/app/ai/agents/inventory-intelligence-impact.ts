import type { InventoryFacts } from "../facts/inventory-facts";
import type {
  InventoryEstimatedImpact,
  InventoryIntelligenceCategory,
  InventoryIntelligenceRecommendationDraft,
} from "../schemas/inventory-intelligence";
import { estimateInventoryRecommendationImpact } from "../tools/inventory-impact-tool";

function findProduct(facts: InventoryFacts, recommendationId: string) {
  const productId = recommendationId.split(":")[1];
  return facts.products.find((product) => product.productId === productId) ?? facts.products[0];
}

export function estimateInventoryRecommendationImpactForFacts(
  facts: InventoryFacts,
  recommendation: Pick<InventoryIntelligenceRecommendationDraft, "category" | "id">,
): InventoryEstimatedImpact {
  const product = findProduct(facts, recommendation.id);

  if (!product) {
    return {};
  }

  return estimateInventoryRecommendationImpact({
    category: recommendation.category,
    velocity: product.velocity,
    availableInventory: product.availableInventory,
    daysRemaining: product.daysRemaining,
    safetyStock: product.safetyStock,
    tiedUpUnits: product.availableInventory ?? 0,
    unitCost: product.unitCost,
  });
}

export function hasInventoryDeterministicImpact(impact: InventoryEstimatedImpact): boolean {
  return Object.values(impact).some((value) => value !== null && value !== undefined && value > 0);
}

export function summarizeInventoryImpactForCategory(
  impact: InventoryEstimatedImpact,
  category: InventoryIntelligenceCategory,
): string {
  if (impact.ordersProtected) {
    return `Protect about ${impact.ordersProtected} orders from stockouts`;
  }

  if (impact.inventoryCostSaved) {
    return `Free about $${impact.inventoryCostSaved.toLocaleString()} in tied-up inventory cost`;
  }

  if (impact.inventoryDaysSaved) {
    return `Improve inventory coverage by about ${impact.inventoryDaysSaved} days`;
  }

  return `Improve ${category.toLowerCase()} performance using current inventory signals`;
}
