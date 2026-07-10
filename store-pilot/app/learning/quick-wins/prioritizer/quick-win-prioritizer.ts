import type { ScoredQuickWin } from "../shared/types";
import { prioritizeForTrial } from "../ranking/quick-win-ranking";

export function selectTopQuickWinsForTrial(
  wins: ScoredQuickWin[],
  limit = 12,
): ScoredQuickWin[] {
  return prioritizeForTrial(wins).slice(0, limit);
}

export function groupWinsByCategory(
  wins: ScoredQuickWin[],
): Record<string, ScoredQuickWin[]> {
  return wins.reduce<Record<string, ScoredQuickWin[]>>((groups, win) => {
    const bucket = groups[win.category] ?? [];
    bucket.push(win);
    groups[win.category] = bucket;
    return groups;
  }, {});
}
