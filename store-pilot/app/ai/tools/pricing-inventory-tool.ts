export function analyzePricingInventory(input: {
  averageWeeksOfCover: number;
  slowMoverCount: number;
  fastMoverCount: number;
  totalProducts: number;
}): { score: number; inventoryRisk: number; issues: string[] } {
  const issues: string[] = [];
  if (input.averageWeeksOfCover > 12) issues.push("inventory_overhang_pricing_pressure");
  if (input.slowMoverCount > input.fastMoverCount) issues.push("slow_mover_markdown_candidate");
  const inventoryRisk = Math.min(
    100,
    Math.round(input.averageWeeksOfCover * 4 + (input.slowMoverCount / Math.max(1, input.totalProducts)) * 40),
  );
  const score = Math.max(0, 100 - inventoryRisk);
  return { score, inventoryRisk, issues };
}
