export function analyzeExecutionRisk(input: {
  blockedOperationCount: number;
  overdueOperationCount: number;
  conflictScore: number;
  inventoryRiskScore: number;
  pricingRiskScore: number;
  revenueGrowthRate: number;
  outOfStockProducts: number;
}): {
  executionRiskScore: number;
  riskLevel: "low" | "medium" | "high";
  topRisks: string[];
  issues: string[];
} {
  const issues: string[] = [];
  const topRisks: string[] = [];

  let score = 0;
  score += Math.min(input.blockedOperationCount, 8) * 9;
  score += Math.min(input.overdueOperationCount, 6) * 7;
  score += Math.min(input.conflictScore, 100) * 0.2;
  score += Math.min(input.inventoryRiskScore, 100) * 0.15;
  score += Math.min(input.pricingRiskScore, 100) * 0.1;
  score += Math.min(input.outOfStockProducts, 12) * 3;

  if (input.revenueGrowthRate < 0) {
    score += 12;
    topRisks.push("Revenue decline increases execution risk.");
  }
  if (input.blockedOperationCount > 0) {
    topRisks.push("Blocked operations are delaying business outcomes.");
  }
  if (input.outOfStockProducts >= 3) {
    topRisks.push("Stockouts are eroding revenue while other work continues.");
  }

  const executionRiskScore = Math.max(0, Math.min(100, Math.round(score)));
  const riskLevel: "low" | "medium" | "high" =
    executionRiskScore >= 65 ? "high" : executionRiskScore >= 35 ? "medium" : "low";

  if (riskLevel === "high") issues.push("execution_risk_high");

  return { executionRiskScore, riskLevel, topRisks, issues };
}
