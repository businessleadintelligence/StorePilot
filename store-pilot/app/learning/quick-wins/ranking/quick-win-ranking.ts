import type { ScoredQuickWin } from "../shared/types";
import { TRIAL_CATEGORY_PRIORITY } from "../shared/constants";

export function rankQuickWins(wins: ScoredQuickWin[]): ScoredQuickWin[] {
  return [...wins].sort((left, right) => {
    if (right.rankScore !== left.rankScore) {
      return right.rankScore - left.rankScore;
    }
    if (right.urgency !== left.urgency) {
      return right.urgency - left.urgency;
    }
    return right.revenueOpportunity - left.revenueOpportunity;
  });
}

export function prioritizeForTrial(wins: ScoredQuickWin[]): ScoredQuickWin[] {
  const ranked = rankQuickWins(wins);

  return [...ranked].sort((left, right) => {
    const leftPriority = TRIAL_CATEGORY_PRIORITY.indexOf(
      left.category as (typeof TRIAL_CATEGORY_PRIORITY)[number],
    );
    const rightPriority = TRIAL_CATEGORY_PRIORITY.indexOf(
      right.category as (typeof TRIAL_CATEGORY_PRIORITY)[number],
    );
    const normalizedLeft = leftPriority === -1 ? 99 : leftPriority;
    const normalizedRight = rightPriority === -1 ? 99 : rightPriority;

    if (normalizedLeft !== normalizedRight) {
      return normalizedLeft - normalizedRight;
    }

    return right.rankScore - left.rankScore;
  });
}

export function buildTrialHighlights(
  wins: ScoredQuickWin[],
  limit = 4,
): Array<{ label: string; count: number }> {
  const priorityTypes = [
    "missing_seo",
    "inventory_risk",
    "pricing_outlier",
    "bundle_candidate",
  ] as const;

  const highlights: Array<{ label: string; count: number }> = [];

  for (const winType of priorityTypes) {
    const win = wins.find((candidate) => candidate.winType === winType);
    if (win && win.affectedCount > 0) {
      highlights.push({ label: win.title, count: win.affectedCount });
    }
    if (highlights.length >= limit) {
      break;
    }
  }

  if (highlights.length < limit) {
    for (const win of wins) {
      if (highlights.some((item) => item.label === win.title)) {
        continue;
      }
      highlights.push({ label: win.title, count: win.affectedCount });
      if (highlights.length >= limit) {
        break;
      }
    }
  }

  return highlights;
}
