import {
  buildBusinessHealthSummary,
  calculateExecutiveCooScores,
  classifyExecutiveHealthBand,
  type ExecutiveCooScores,
} from "./executive-business-health-tool";

export type { ExecutiveCooScores } from "./executive-business-health-tool";

export function calculateExecutiveCooHealthScore(input: {
  scores: ExecutiveCooScores;
  criticalIssueCount: number;
}): number {
  let score = input.scores.executiveHealthScore;
  score -= Math.min(input.criticalIssueCount, 12) * 3;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export { classifyExecutiveHealthBand, buildBusinessHealthSummary, calculateExecutiveCooScores };

export function buildExecutiveCooHealthExplanation(input: {
  businessHealthScore: number;
  scores: ExecutiveCooScores;
  criticalIssueCount: number;
}): {
  score: number;
  summary: string;
  drivers: Array<{ factor: string; direction: "positive" | "negative" | "neutral"; detail: string }>;
} {
  const explanation = buildBusinessHealthSummary({
    scores: input.scores,
    criticalBlockerCount: input.criticalIssueCount,
  });

  return {
    score: explanation.score,
    summary: explanation.headline,
    drivers: explanation.drivers.map((driver) => ({
      factor: "Business health",
      direction: explanation.band === "strong" ? "positive" : explanation.band === "weak" ? "negative" : "neutral",
      detail: driver,
    })),
  };
}
