import type { ExecutiveCooFacts } from "../facts/executive-coo-facts";
import type {
  ExecutiveCooEstimatedImpact,
  ExecutiveCooFocusArea,
  ExecutiveCooTopPriorityDraft,
} from "../schemas/executive-coo";
import { sectionScoreForFocusArea } from "./executive-coo-evidence";

const DIFFICULTY_WEIGHTS: Record<string, number> = {
  Easy: 1.1,
  Medium: 1,
  Hard: 0.85,
};

export type RankedExecutiveCooTopPriorityDraft = ExecutiveCooTopPriorityDraft & {
  priorityScore: number;
};

export type ExecutiveCooMerchantPreferenceProfile = {
  dismissedFocusAreas: Set<ExecutiveCooFocusArea>;
  snoozedFocusAreas: Set<ExecutiveCooFocusArea>;
  ignoredFocusAreas: Set<ExecutiveCooFocusArea>;
  implementedFocusAreas: Set<ExecutiveCooFocusArea>;
};

export function calculateExecutiveCooPriorityScore(input: {
  confidence: number;
  difficultyWeight: number;
  impact: ExecutiveCooEstimatedImpact;
  sectionScore: number;
  executionOrder: number;
}): number {
  const impactScore =
    (input.impact.revenueOpportunity ?? 0) * 0.35 +
    (input.impact.revenueRecovered ?? 0) * 0.25 +
    (input.impact.inventoryReduction ?? 0) * 0.2 +
    (input.impact.conversionLift ?? 0) * 0.15 +
    (input.impact.ordersProtected ?? 0) * 0.05;

  const urgency = Math.max(0, 100 - input.sectionScore);
  const orderBoost = Math.max(0, 6 - input.executionOrder) * 4;
  const raw =
    impactScore * 0.45 +
    urgency * 0.3 +
    input.confidence * 100 * 0.2 +
    orderBoost * input.difficultyWeight * 0.05;

  return Math.max(0, Math.min(100, Math.round(raw)));
}

export function rankExecutiveCooPriorities<T extends { priorityScore: number; confidence: number; executionOrder: number }>(
  items: T[],
): T[] {
  return [...items].sort(
    (left, right) =>
      left.executionOrder - right.executionOrder ||
      right.priorityScore - left.priorityScore ||
      right.confidence - left.confidence,
  );
}

export function deriveExecutiveCooOverallPriority(scores: number[]): number {
  const top = scores[0] ?? 0;
  if (top >= 85) return 1;
  if (top >= 70) return 2;
  if (top >= 50) return 3;
  return 4;
}

export function deriveExecutiveCooOverallConfidence(confidences: number[]): number {
  if (confidences.length === 0) return 0;
  const total = confidences.reduce((sum, value) => sum + value, 0);
  return Math.round((total / confidences.length) * 100) / 100;
}

export function buildExecutiveCooMerchantPreferenceProfile(
  records: Array<{ category: string; status: string; payloadJson: Record<string, unknown> }>,
): ExecutiveCooMerchantPreferenceProfile {
  const dismissedFocusAreas = new Set<ExecutiveCooFocusArea>();
  const snoozedFocusAreas = new Set<ExecutiveCooFocusArea>();
  const ignoredFocusAreas = new Set<ExecutiveCooFocusArea>();
  const implementedFocusAreas = new Set<ExecutiveCooFocusArea>();

  for (const record of records) {
    const focusArea = record.category as ExecutiveCooFocusArea;
    const feedback = String(record.payloadJson.feedback ?? "").toLowerCase();

    if (feedback === "snoozed" || record.payloadJson.snoozedUntil) {
      snoozedFocusAreas.add(focusArea);
    }

    if (feedback === "ignored") {
      ignoredFocusAreas.add(focusArea);
    }

    if (record.status === "dismissed") {
      dismissedFocusAreas.add(focusArea);
    }

    if (record.status === "implemented" || record.status === "verified") {
      implementedFocusAreas.add(focusArea);
    }
  }

  return {
    dismissedFocusAreas,
    snoozedFocusAreas,
    ignoredFocusAreas,
    implementedFocusAreas,
  };
}

export function rankExecutiveCooTopPriorities(input: {
  facts: ExecutiveCooFacts;
  priorities: ExecutiveCooTopPriorityDraft[];
  impacts: Map<string, ExecutiveCooEstimatedImpact>;
  preferences?: ExecutiveCooMerchantPreferenceProfile;
}): RankedExecutiveCooTopPriorityDraft[] {
  const ranked = input.priorities.map((priority) => {
    const impact = input.impacts.get(priority.id) ?? {};
    const difficultyWeight = DIFFICULTY_WEIGHTS[priority.difficulty] ?? 1;
    let priorityScore = calculateExecutiveCooPriorityScore({
      confidence: priority.confidence,
      difficultyWeight,
      impact,
      sectionScore: sectionScoreForFocusArea(input.facts, priority.focusArea),
      executionOrder: priority.executionOrder,
    });

    if (input.preferences?.ignoredFocusAreas.has(priority.focusArea)) {
      priorityScore = Math.max(0, priorityScore - 15);
    }

    if (input.preferences?.dismissedFocusAreas.has(priority.focusArea)) {
      priorityScore = Math.max(0, priorityScore - 10);
    }

    return {
      ...priority,
      priorityScore,
    };
  });

  return rankExecutiveCooPriorities(ranked);
}
