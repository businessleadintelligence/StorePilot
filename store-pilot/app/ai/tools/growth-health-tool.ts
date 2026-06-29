import type { GrowthIntelligenceScores } from "./growth-score-tool";

export function calculateGrowthIntelligenceHealthScore(input: {
  scores: GrowthIntelligenceScores;
  criticalIssueCount: number;
}): number {
  let score = input.scores.growthHealthScore;
  score -= Math.min(input.criticalIssueCount, 12) * 3;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function classifyGrowthHealthBand(score: number): "strong" | "watch" | "weak" {
  if (score >= 80) return "strong";
  if (score >= 60) return "watch";
  return "weak";
}

export function buildGrowthHealthExplanation(input: {
  growthHealthScore: number;
  scores: GrowthIntelligenceScores;
  criticalIssueCount: number;
}): {
  score: number;
  summary: string;
  drivers: Array<{ factor: string; direction: "positive" | "negative" | "neutral"; detail: string }>;
} {
  const drivers: Array<{ factor: string; direction: "positive" | "negative" | "neutral"; detail: string }> = [];

  if (input.scores.revenueGrowthRate >= 10) {
    drivers.push({
      factor: "Revenue momentum",
      direction: "positive",
      detail: "Recent revenue trend supports growth initiatives.",
    });
  } else if (input.scores.revenueGrowthRate < 0) {
    drivers.push({
      factor: "Revenue momentum",
      direction: "negative",
      detail: "Revenue is declining and growth levers need stabilization first.",
    });
  }

  if (input.scores.retentionScore >= 60) {
    drivers.push({
      factor: "Retention",
      direction: "positive",
      detail: "Returning customers provide a solid base for expansion.",
    });
  } else {
    drivers.push({
      factor: "Retention",
      direction: "negative",
      detail: "Retention is weak and limits sustainable growth.",
    });
  }

  if (input.scores.upsellOpportunity >= 50 || input.scores.crossSellOpportunity >= 50) {
    drivers.push({
      factor: "Basket expansion",
      direction: "positive",
      detail: "Upsell and cross-sell opportunities can lift AOV quickly.",
    });
  }

  if (input.criticalIssueCount > 0) {
    drivers.push({
      factor: "Critical growth risks",
      direction: "negative",
      detail: `${input.criticalIssueCount} critical growth issue(s) need attention.`,
    });
  }

  const band = classifyGrowthHealthBand(input.growthHealthScore);
  const summary =
    band === "strong"
      ? "Growth foundations are healthy with clear upside in AOV, retention, and merchandising."
      : band === "watch"
        ? "Growth health is mixed; prioritize retention stability and quick revenue wins."
        : "Growth is under pressure; stabilize revenue and retention before scaling campaigns.";

  return { score: input.growthHealthScore, summary, drivers };
}
