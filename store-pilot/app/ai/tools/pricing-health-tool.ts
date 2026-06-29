import type { PricingIntelligenceScores } from "./pricing-score-tool";

export function calculatePricingIntelligenceHealthScore(input: {
  scores: PricingIntelligenceScores;
  criticalIssueCount: number;
}): number {
  let score = input.scores.pricingHealthScore;
  score -= Math.min(input.criticalIssueCount, 12) * 3;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function classifyPricingHealthBand(score: number): "strong" | "watch" | "weak" {
  if (score >= 80) return "strong";
  if (score >= 60) return "watch";
  return "weak";
}

export function buildPricingHealthExplanation(input: {
  pricingHealthScore: number;
  scores: PricingIntelligenceScores;
  criticalIssueCount: number;
}): {
  score: number;
  summary: string;
  drivers: Array<{ factor: string; direction: "positive" | "negative" | "neutral"; detail: string }>;
} {
  const drivers: Array<{ factor: string; direction: "positive" | "negative" | "neutral"; detail: string }> = [];

  if (input.scores.marginPercent >= 40) {
    drivers.push({ factor: "Margin", direction: "positive", detail: "Gross margin supports healthy pricing power." });
  } else {
    drivers.push({ factor: "Margin", direction: "negative", detail: "Margin is thin and limits pricing flexibility." });
  }

  if (input.scores.discountDependence <= 35) {
    drivers.push({ factor: "Discount dependence", direction: "positive", detail: "Sales are not overly reliant on discounts." });
  } else {
    drivers.push({ factor: "Discount dependence", direction: "negative", detail: "Discount frequency is eroding pricing discipline." });
  }

  if (input.scores.premiumPricingOpportunity >= 50) {
    drivers.push({
      factor: "Premium opportunity",
      direction: "positive",
      detail: "Strong-demand products can support premium positioning.",
    });
  }

  if (input.criticalIssueCount > 0) {
    drivers.push({
      factor: "Critical pricing risks",
      direction: "negative",
      detail: `${input.criticalIssueCount} critical pricing issue(s) need attention.`,
    });
  }

  const band = classifyPricingHealthBand(input.pricingHealthScore);
  const summary =
    band === "strong"
      ? "Pricing strategy is disciplined with selective upside in premium and bundle positioning."
      : band === "watch"
        ? "Pricing health is mixed; margin protection and discount discipline should be prioritized."
        : "Pricing strategy is under pressure; address margin leaks and discount dependence first.";

  return { score: input.pricingHealthScore, summary, drivers };
}

export function estimateMarkdownPercent(input: {
  markdownLineItems: number;
  totalLineItems: number;
}): number {
  if (input.totalLineItems <= 0) return 0;
  return Math.round((input.markdownLineItems / input.totalLineItems) * 100);
}

export function estimateSellThrough(input: { unitsSold: number; inventoryUnits: number }): number {
  if (input.inventoryUnits <= 0) return input.unitsSold > 0 ? 100 : 0;
  return Math.min(100, Math.round((input.unitsSold / input.inventoryUnits) * 100));
}

export function estimatePricePositionScore(input: {
  prices: number[];
  medianPrice: number;
}): number {
  if (input.prices.length === 0 || input.medianPrice <= 0) return 50;
  const aligned = input.prices.filter((price) => {
    const ratio = price / input.medianPrice;
    return ratio >= 0.85 && ratio <= 1.15;
  }).length;
  return Math.round((aligned / input.prices.length) * 100);
}
