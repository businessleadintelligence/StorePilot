import type { TrendFacts } from "../facts/trend-facts";
import type { TrendHealthExplanation } from "../schemas/trend-intelligence";
import { classifyTrendHealthBand } from "../tools/trend-health-tool";

export function buildTrendHealthExplanation(facts: TrendFacts): TrendHealthExplanation {
  const band = classifyTrendHealthBand(facts.trendHealthScore);
  return {
    score: facts.trendHealthScore,
    summary: `Trend health is ${band} with direction ${facts.trendDirection}.`,
    drivers: [
      {
        factor: "Emerging products",
        direction: facts.momentum.emergingCount > 0 ? "positive" : "neutral",
        detail: `${facts.momentum.emergingCount} products show emerging demand`,
      },
      {
        factor: "Declining products",
        direction: facts.momentum.decliningCount > 0 ? "negative" : "neutral",
        detail: `${facts.momentum.decliningCount} products show declining demand`,
      },
      {
        factor: "Store growth",
        direction: facts.rollingGrowth.storeGrowthRate >= 0 ? "positive" : "negative",
        detail: `Store growth rate is ${facts.rollingGrowth.storeGrowthRate}%`,
      },
      {
        factor: "Risk level",
        direction: facts.riskLevel === "high" ? "negative" : "neutral",
        detail: `Trend risk is ${facts.riskLevel}`,
      },
    ],
  };
}
