import type { ExecutiveCooScores } from "./executive-business-health-tool";

export function buildExecutiveSummarySignals(input: {
  scores: ExecutiveCooScores;
  businessUrgency: number;
  executiveConfidence: number;
  topPriorityTitles: string[];
  blockerCount: number;
  opportunityCostScore: number;
}): {
  headline: string;
  keySignals: string[];
  narrativeHints: string[];
} {
  const keySignals: string[] = [];
  const narrativeHints: string[] = [];

  if (input.scores.businessHealthScore >= 75) {
    keySignals.push("Business fundamentals are stable.");
  } else {
    keySignals.push("Business fundamentals need reinforcement.");
  }

  if (input.businessUrgency >= 60) {
    keySignals.push("Urgency is elevated across operations.");
    narrativeHints.push("Lead with time-sensitive blockers and revenue protection.");
  }

  if (input.blockerCount > 0) {
    keySignals.push(`${input.blockerCount} blocker(s) are slowing execution.`);
  }

  if (input.opportunityCostScore >= 50) {
    keySignals.push("Delay is carrying measurable opportunity cost.");
  }

  if (input.topPriorityTitles.length > 0) {
    narrativeHints.push(`Anchor the narrative around: ${input.topPriorityTitles.slice(0, 2).join("; ")}.`);
  }

  const headline =
    input.scores.executiveHealthScore >= 75
      ? "Executive posture is strong with a clear action sequence."
      : input.scores.executiveHealthScore >= 55
        ? "Executive posture is workable but requires tighter focus."
        : "Executive posture is strained; reduce scope and clear blockers first.";

  narrativeHints.push(`Confidence baseline: ${Math.round(input.executiveConfidence * 100)}%.`);

  return { headline, keySignals, narrativeHints };
}
