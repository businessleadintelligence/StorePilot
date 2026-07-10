import type { ScoredExecutiveDecision } from "../../shared/types";

const TRIAL_CATEGORY_ORDER = [
  "inventory",
  "risk",
  "pricing",
  "operations",
  "growth",
  "seo",
  "bundles",
  "catalog",
  "collections",
] as const;

export function rankExecutiveDecisions(
  decisions: ScoredExecutiveDecision[],
): ScoredExecutiveDecision[] {
  return [...decisions].sort((left, right) => {
    if (right.rankScore !== left.rankScore) {
      return right.rankScore - left.rankScore;
    }
    if (right.urgency !== left.urgency) {
      return right.urgency - left.urgency;
    }
    return right.estimatedRevenueImpact - left.estimatedRevenueImpact;
  });
}

export function prioritizeExecutiveDecisions(
  decisions: ScoredExecutiveDecision[],
): ScoredExecutiveDecision[] {
  const ranked = rankExecutiveDecisions(decisions);

  return [...ranked].sort((left, right) => {
    const leftIndex = TRIAL_CATEGORY_ORDER.indexOf(
      left.category as (typeof TRIAL_CATEGORY_ORDER)[number],
    );
    const rightIndex = TRIAL_CATEGORY_ORDER.indexOf(
      right.category as (typeof TRIAL_CATEGORY_ORDER)[number],
    );
    const normalizedLeft = leftIndex === -1 ? 99 : leftIndex;
    const normalizedRight = rightIndex === -1 ? 99 : rightIndex;

    if (normalizedLeft !== normalizedRight) {
      return normalizedLeft - normalizedRight;
    }

    return right.rankScore - left.rankScore;
  });
}

export function selectTopExecutiveDecisions(
  decisions: ScoredExecutiveDecision[],
  limit = 20,
): ScoredExecutiveDecision[] {
  return prioritizeExecutiveDecisions(decisions).slice(0, limit);
}
