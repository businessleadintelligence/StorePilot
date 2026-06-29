import type { ProductFacts } from "../facts/product-facts";
import type {
  EstimatedImpact,
  ProductIntelligenceCategory,
  ProductIntelligenceRecommendationDraft,
} from "../schemas/product-intelligence";

function averageUnitPrice(facts: ProductFacts): number | null {
  if (facts.sales30Days <= 0) {
    return null;
  }

  return facts.revenue30Days / facts.sales30Days;
}

export function estimateRecommendationImpact(
  facts: ProductFacts,
  recommendation: Pick<ProductIntelligenceRecommendationDraft, "category" | "id">,
): EstimatedImpact {
  const unitPrice = averageUnitPrice(facts);
  const impact: EstimatedImpact = {};

  switch (recommendation.category) {
    case "Inventory": {
      if (facts.stockRisk === "CRITICAL" || facts.stockRisk === "HIGH") {
        const protectedOrders = Math.max(1, Math.round(facts.velocity * 14));
        impact.ordersProtected = protectedOrders;
        if (unitPrice !== null) {
          impact.revenueRecovered = Math.round(protectedOrders * unitPrice);
          impact.estimatedLostSales = Math.round(facts.velocity * 7 * unitPrice);
        }
        if (facts.daysRemaining !== null) {
          impact.inventoryDaysSaved = Math.max(0, 14 - facts.daysRemaining);
        }
      } else if (facts.daysRemaining !== null && facts.daysRemaining > 90) {
        impact.inventoryCostSaved = Math.round((facts.availableInventory ?? 0) * 0.05);
      }
      break;
    }
    case "Revenue":
    case "Promotion":
    case "Merchandising": {
      if (unitPrice !== null && facts.sales30Days > 0) {
        const uplift = Math.max(1, Math.round(facts.sales30Days * 0.1));
        impact.revenueOpportunity = Math.round(uplift * unitPrice);
      }
      break;
    }
    case "Pricing": {
      if (facts.margin !== null && facts.margin < 20 && unitPrice !== null) {
        impact.marginImprovement = Math.round(unitPrice * 0.03 * Math.max(1, facts.sales30Days));
      }
      break;
    }
    default:
      break;
  }

  return impact;
}

export function hasDeterministicImpact(impact: EstimatedImpact): boolean {
  return Object.values(impact).some((value) => value !== null && value !== undefined && value > 0);
}

export function summarizeImpact(impact: EstimatedImpact, category: ProductIntelligenceCategory): string {
  if (impact.revenueRecovered) {
    return `Protect about $${impact.revenueRecovered.toLocaleString()} in revenue`;
  }

  if (impact.revenueOpportunity) {
    return `Capture about $${impact.revenueOpportunity.toLocaleString()} in incremental revenue`;
  }

  if (impact.inventoryCostSaved) {
    return `Reduce holding cost by about $${impact.inventoryCostSaved.toLocaleString()}`;
  }

  if (impact.marginImprovement) {
    return `Improve margin by about $${impact.marginImprovement.toLocaleString()}`;
  }

  if (impact.ordersProtected) {
    return `Protect about ${impact.ordersProtected} orders`;
  }

  return `Improve ${category.toLowerCase()} performance using current product signals`;
}
