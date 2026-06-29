export type ExecutiveTimelineEntry = {
  detected: string;
  created: string;
  viewed: string | null;
  implemented: string | null;
  verifying: string | null;
  verified: string | null;
  closed: string | null;
};

export function buildExecutiveTimeline(input: {
  computedAt: string;
  difficulty: string;
  priorityScore: number;
  blocked: boolean;
}): ExecutiveTimelineEntry & { suggestedWindow: string } {
  const created = input.computedAt;
  const detected = created;

  let daysToImplement = 7;
  if (input.difficulty === "Easy") daysToImplement = 3;
  if (input.difficulty === "Hard") daysToImplement = 14;
  if (input.priorityScore >= 80) daysToImplement = Math.max(1, daysToImplement - 2);
  if (input.blocked) daysToImplement += 5;

  const suggestedWindow =
    daysToImplement <= 3
      ? "This week"
      : daysToImplement <= 7
        ? "Next 7 days"
        : daysToImplement <= 14
          ? "Next 2 weeks"
          : "This month";

  return {
    detected,
    created,
    viewed: null,
    implemented: null,
    verifying: null,
    verified: null,
    closed: null,
    suggestedWindow,
  };
}

export function buildExecutivePlanningHorizons(input: {
  computedAt: string;
  topPriorityIds: string[];
  weeklyFocusIds: string[];
  monthlyObjectiveIds: string[];
}): {
  dailyBriefing: string[];
  weeklyPlan: string[];
  monthlyObjectives: string[];
} {
  return {
    dailyBriefing: input.topPriorityIds.slice(0, 3),
    weeklyPlan: input.weeklyFocusIds.slice(0, 6),
    monthlyObjectives: input.monthlyObjectiveIds.slice(0, 8),
  };
}
