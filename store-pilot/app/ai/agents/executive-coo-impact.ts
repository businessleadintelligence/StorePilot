import type { ExecutiveCooFacts } from "../facts/executive-coo-facts";
import type {
  ExecutiveCooEstimatedImpact,
  ExecutiveCooTopPriorityDraft,
} from "../schemas/executive-coo";
import { sectionScoreForFocusArea } from "./executive-coo-evidence";

export function hasExecutiveCooDeterministicImpact(impact: ExecutiveCooEstimatedImpact): boolean {
  return (
    (impact.revenueOpportunity ?? 0) > 0 ||
    (impact.revenueRecovered ?? 0) > 0 ||
    (impact.inventoryReduction ?? 0) > 0 ||
    (impact.conversionLift ?? 0) > 0 ||
    (impact.ordersProtected ?? 0) > 0
  );
}

function estimateExecutiveCooPriorityImpactInternal(input: {
  focusArea: string;
  confidence: number;
  sectionScore: number;
  facts: ExecutiveCooFacts;
}): ExecutiveCooEstimatedImpact {
  const gap = Math.max(0, 100 - input.sectionScore);
  const multiplier = input.confidence * (gap / 100);

  const revenueBase = input.facts.revenueOpportunity * multiplier;
  const inventoryBase = input.facts.inventoryRisk * multiplier;
  const conversionBase = gap * multiplier * 0.4;

  if (input.focusArea === "Inventory" || input.focusArea === "Fulfillment") {
    return {
      inventoryReduction: Math.round(inventoryBase),
      ordersProtected: Math.round(multiplier * 12),
      revenueRecovered: Math.round(revenueBase * 0.35),
    };
  }

  if (input.focusArea === "Revenue" || input.focusArea === "Growth") {
    return {
      revenueOpportunity: Math.round(revenueBase),
      conversionLift: Math.round(conversionBase),
      revenueRecovered: Math.round(revenueBase * 0.5),
    };
  }

  if (input.focusArea === "Marketing" || input.focusArea === "Product") {
    return {
      conversionLift: Math.round(conversionBase),
      revenueOpportunity: Math.round(revenueBase * 0.6),
    };
  }

  return {
    revenueOpportunity: Math.round(revenueBase * 0.45),
    inventoryReduction: Math.round(inventoryBase * 0.25),
    conversionLift: Math.round(conversionBase * 0.5),
  };
}

export function estimateExecutiveCooPriorityImpact(
  facts: ExecutiveCooFacts,
  priority: ExecutiveCooTopPriorityDraft,
): ExecutiveCooEstimatedImpact {
  return estimateExecutiveCooPriorityImpactInternal({
    focusArea: priority.focusArea,
    confidence: priority.confidence,
    sectionScore: sectionScoreForFocusArea(facts, priority.focusArea),
    facts,
  });
}

export function estimateExecutiveCooPriorityImpactForFacts(
  facts: ExecutiveCooFacts,
  priority: ExecutiveCooTopPriorityDraft,
): ExecutiveCooEstimatedImpact {
  return estimateExecutiveCooPriorityImpact(facts, priority);
}

export function estimateExecutiveCooRevenueGain(
  impact: ExecutiveCooEstimatedImpact,
  sectionScore: number,
): number {
  const base = (impact.revenueOpportunity ?? 0) + (impact.revenueRecovered ?? 0);
  return Math.round(base * (1 + (100 - sectionScore) / 200));
}

export function estimateExecutiveCooInventoryReduction(impact: ExecutiveCooEstimatedImpact): number {
  return Math.round(impact.inventoryReduction ?? 0);
}

export function estimateExecutiveCooConversionLift(
  impact: ExecutiveCooEstimatedImpact,
  sectionScore: number,
): number {
  return Math.round((impact.conversionLift ?? 0) * (1 + (100 - sectionScore) / 150));
}
