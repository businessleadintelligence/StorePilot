export function detectOpportunityGaps(input: {
  emergingProductCount: number;
  decliningProductCount: number;
  lowInventoryEmergingCount: number;
  uncapturedCategoryCount: number;
}): {
  level: "low" | "medium" | "high";
  gaps: string[];
} {
  const gaps: string[] = [];

  if (input.lowInventoryEmergingCount > 0) {
    gaps.push("emerging_demand_low_inventory");
  }
  if (input.uncapturedCategoryCount > 0) {
    gaps.push("category_momentum_gap");
  }
  if (input.emergingProductCount > input.decliningProductCount) {
    gaps.push("merchandising_opportunity");
  }
  if (input.decliningProductCount > input.emergingProductCount) {
    gaps.push("demand_recovery_needed");
  }

  let level: "low" | "medium" | "high" = "low";
  if (gaps.length >= 3) level = "high";
  else if (gaps.length >= 1) level = "medium";

  return { level, gaps };
}
