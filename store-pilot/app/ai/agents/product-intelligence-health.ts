import type { ProductFacts } from "../facts/product-facts";
import type { HealthExplanation } from "../schemas/product-intelligence";

export function buildHealthExplanation(facts: ProductFacts): HealthExplanation {
  const drivers: HealthExplanation["drivers"] = [];

  if (facts.trend === "declining") {
    drivers.push({
      factor: "Revenue trend",
      direction: "negative",
      detail: "Recent sales trend is declining versus the 30 day baseline.",
    });
  } else if (facts.trend === "growing") {
    drivers.push({
      factor: "Revenue trend",
      direction: "positive",
      detail: "Recent sales trend is growing versus the 30 day baseline.",
    });
  } else {
    drivers.push({
      factor: "Revenue trend",
      direction: "neutral",
      detail: "Recent sales trend is stable.",
    });
  }

  if (facts.daysRemaining !== null && facts.daysRemaining > 120) {
    drivers.push({
      factor: "Inventory aging",
      direction: "negative",
      detail: `Inventory coverage is high at ${facts.daysRemaining} days.`,
    });
  } else if (facts.daysRemaining !== null && facts.daysRemaining <= 14) {
    drivers.push({
      factor: "Inventory coverage",
      direction: "negative",
      detail: `Inventory coverage is low at ${facts.daysRemaining} days.`,
    });
  }

  if (facts.velocity > 0 && facts.trend === "declining") {
    drivers.push({
      factor: "Velocity",
      direction: "negative",
      detail: `Sales velocity is slowing at ${facts.velocity.toFixed(2)} units/day.`,
    });
  } else if (facts.velocity > 0 && facts.trend === "growing") {
    drivers.push({
      factor: "Velocity",
      direction: "positive",
      detail: `Sales velocity is improving at ${facts.velocity.toFixed(2)} units/day.`,
    });
  }

  if (facts.refundRate >= 5) {
    drivers.push({
      factor: "Refunds",
      direction: "negative",
      detail: `Refund rate increased to ${facts.refundRate.toFixed(1)}% in the last 30 days.`,
    });
  } else {
    drivers.push({
      factor: "Refunds",
      direction: "positive",
      detail: `Refund rate remains stable at ${facts.refundRate.toFixed(1)}%.`,
    });
  }

  if (facts.stockRisk === "CRITICAL" || facts.stockRisk === "HIGH") {
    drivers.push({
      factor: "Stock coverage",
      direction: "negative",
      detail: `Stock risk is ${facts.stockRisk.toLowerCase()} with ${facts.availableInventory ?? 0} units available.`,
    });
  } else if (facts.daysRemaining !== null && facts.daysRemaining > 90) {
    drivers.push({
      factor: "Stock coverage",
      direction: "negative",
      detail: "Stock coverage is excessive relative to current sales velocity.",
    });
  }

  const negativeCount = drivers.filter((driver) => driver.direction === "negative").length;
  const summary =
    negativeCount >= 3
      ? `Health decreased because multiple negative signals are affecting ${facts.title}.`
      : negativeCount === 0
        ? `Health is supported by stable product performance signals for ${facts.title}.`
        : `Health score reflects mixed performance signals for ${facts.title}.`;

  return {
    score: facts.healthScore,
    summary,
    drivers,
  };
}
