import type { BundleIntelligenceGroup } from "../schemas/bundle-intelligence";

export function assignBundleRecommendationGroup(input: {
  category: string;
  priorityScore: number;
  bundleType: string;
}): BundleIntelligenceGroup {
  if (input.bundleType === "dead_inventory_bundle" || input.category === "Dead Inventory Bundle") {
    return "Inventory Recovery Bundles";
  }

  if (input.category === "High Margin Bundle" || input.bundleType === "high_margin_bundle") {
    return "High Margin Bundles";
  }

  if (input.priorityScore >= 75) {
    return "Top Bundle Opportunities";
  }

  if (input.priorityScore >= 55 || input.category === "Accessory Bundle") {
    return "Quick Win Bundles";
  }

  return "Long-Term Merchandising";
}

export function buildBundleRecommendationGroups(
  recommendations: Array<{ id: string; group: BundleIntelligenceGroup }>,
) {
  return {
    topBundleOpportunities: recommendations
      .filter((item) => item.group === "Top Bundle Opportunities")
      .map((item) => item.id),
    quickWinBundles: recommendations
      .filter((item) => item.group === "Quick Win Bundles")
      .map((item) => item.id),
    inventoryRecoveryBundles: recommendations
      .filter((item) => item.group === "Inventory Recovery Bundles")
      .map((item) => item.id),
    highMarginBundles: recommendations
      .filter((item) => item.group === "High Margin Bundles")
      .map((item) => item.id),
    longTermMerchandising: recommendations
      .filter((item) => item.group === "Long-Term Merchandising")
      .map((item) => item.id),
  };
}
