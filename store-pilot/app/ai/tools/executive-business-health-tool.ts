export type ExecutiveCooScoreInput = {
  storeHealthScore: number;
  productHealthScore: number | null;
  inventoryHealthScore: number | null;
  bundleHealthScore: number | null;
  storeAuditScore: number | null;
  seoHealthScore: number | null;
  pricingHealthScore: number | null;
  growthHealthScore: number | null;
  revenueGrowthRate: number;
  orderCount: number;
  openOperationCount: number;
  blockedOperationCount: number;
  openRecommendationCount: number;
  agentConfidenceAvg: number;
};

export type ExecutiveCooScores = {
  businessHealthScore: number;
  executiveHealthScore: number;
  businessMomentum: number;
  growthMomentum: number;
  storeHealthScore: number;
  agentHealthAverage: number;
  executionPressure: number;
  revenueGrowthRate: number;
};

export function calculateBusinessHealthScore(input: ExecutiveCooScoreInput): number {
  const agentScores = [
    input.productHealthScore,
    input.inventoryHealthScore,
    input.bundleHealthScore,
    input.storeAuditScore,
    input.seoHealthScore,
    input.pricingHealthScore,
    input.growthHealthScore,
  ].filter((score): score is number => score != null);

  const agentAverage =
    agentScores.length > 0
      ? agentScores.reduce((sum, score) => sum + score, 0) / agentScores.length
      : input.storeHealthScore;

  let score =
    input.storeHealthScore * 0.35 +
    agentAverage * 0.4 +
    Math.max(0, Math.min(100, 50 + input.revenueGrowthRate * 0.4)) * 0.15 +
    input.agentConfidenceAvg * 100 * 0.1;

  score -= Math.min(input.blockedOperationCount, 5) * 4;
  score -= Math.min(input.openOperationCount, 12) * 1.5;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function calculateExecutiveHealthScore(input: ExecutiveCooScoreInput): number {
  const businessHealth = calculateBusinessHealthScore(input);
  const executionDrag = Math.min(100, input.openOperationCount * 6 + input.blockedOperationCount * 10);
  const backlogDrag = Math.min(40, input.openRecommendationCount * 2);

  let score = businessHealth * 0.7 + input.agentConfidenceAvg * 100 * 0.2;
  score -= executionDrag * 0.08;
  score -= backlogDrag * 0.05;

  if (input.orderCount <= 0) {
    score -= 12;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function calculateBusinessMomentum(input: {
  revenueGrowthRate: number;
  businessHealthScore: number;
  implementedActionCount: number;
  verifiedOperationCount: number;
}): number {
  const revenueMomentum = Math.max(0, Math.min(100, 50 + input.revenueGrowthRate * 0.55));
  const executionMomentum = Math.min(100, input.implementedActionCount * 5 + input.verifiedOperationCount * 8);
  const healthMomentum = input.businessHealthScore * 0.35;

  return Math.max(
    0,
    Math.min(100, Math.round(revenueMomentum * 0.45 + executionMomentum * 0.25 + healthMomentum * 0.3)),
  );
}

export function calculateExecutiveCooScores(input: ExecutiveCooScoreInput & {
  implementedActionCount: number;
  verifiedOperationCount: number;
  growthMomentum: number;
}): ExecutiveCooScores {
  const businessHealthScore = calculateBusinessHealthScore(input);
  const executiveHealthScore = calculateExecutiveHealthScore(input);
  const businessMomentum = calculateBusinessMomentum({
    revenueGrowthRate: input.revenueGrowthRate,
    businessHealthScore,
    implementedActionCount: input.implementedActionCount,
    verifiedOperationCount: input.verifiedOperationCount,
  });

  const agentScores = [
    input.productHealthScore,
    input.inventoryHealthScore,
    input.bundleHealthScore,
    input.storeAuditScore,
    input.seoHealthScore,
    input.pricingHealthScore,
    input.growthHealthScore,
  ].filter((score): score is number => score != null);

  const agentHealthAverage =
    agentScores.length > 0
      ? Math.round(agentScores.reduce((sum, score) => sum + score, 0) / agentScores.length)
      : input.storeHealthScore;

  const executionPressure = Math.max(
    0,
    Math.min(100, Math.round(input.openOperationCount * 7 + input.blockedOperationCount * 12)),
  );

  return {
    businessHealthScore,
    executiveHealthScore,
    businessMomentum,
    growthMomentum: input.growthMomentum,
    storeHealthScore: input.storeHealthScore,
    agentHealthAverage,
    executionPressure,
    revenueGrowthRate: input.revenueGrowthRate,
  };
}

export function classifyExecutiveHealthBand(score: number): "strong" | "watch" | "weak" {
  if (score >= 80) return "strong";
  if (score >= 60) return "watch";
  return "weak";
}

export function buildBusinessHealthSummary(input: {
  scores: ExecutiveCooScores;
  criticalBlockerCount: number;
}): { score: number; band: "strong" | "watch" | "weak"; headline: string; drivers: string[] } {
  const band = classifyExecutiveHealthBand(input.scores.businessHealthScore);
  const drivers: string[] = [];

  if (input.scores.revenueGrowthRate >= 8) {
    drivers.push("Revenue trend is positive and supports expansion.");
  } else if (input.scores.revenueGrowthRate < 0) {
    drivers.push("Revenue is declining and needs stabilization first.");
  }

  if (input.scores.agentHealthAverage >= 70) {
    drivers.push("Specialist agents report healthy store foundations.");
  } else {
    drivers.push("Multiple specialist domains need attention.");
  }

  if (input.criticalBlockerCount > 0) {
    drivers.push(`${input.criticalBlockerCount} critical blocker(s) are slowing execution.`);
  }

  const headline =
    band === "strong"
      ? "Business health is strong with clear execution runway."
      : band === "watch"
        ? "Business health is mixed; prioritize blockers and quick wins."
        : "Business health is under pressure; stabilize fundamentals before scaling.";

  return { score: input.scores.businessHealthScore, band, headline, drivers };
}
