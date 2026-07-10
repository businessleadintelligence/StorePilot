import type { CausalTimelineEvent, CausalChainStep } from "../shared/types";

export function buildCausalTimeline(input: {
  chain: CausalChainStep[];
  outcomeLabel: string;
}): CausalTimelineEvent[] {
  const events: CausalTimelineEvent[] = [];

  input.chain.forEach((step, index) => {
    events.push({
      eventId: `timeline-${step.stepId}`,
      dayOffset: -(input.chain.length - index),
      label: step.label,
      signal: step.domain,
      evidenceIds: step.evidenceIds,
      role: index === 0 ? "cause" : index === input.chain.length - 1 ? "consequence" : "signal",
    });
  });

  events.push({
    eventId: "timeline-outcome",
    dayOffset: 0,
    label: input.outcomeLabel,
    signal: "outcome",
    evidenceIds: input.chain.at(-1)?.evidenceIds ?? [],
    role: "consequence",
  });

  return events;
}

export function buildBusinessTimeline(input: {
  storeId: string;
  timelines: CausalTimelineEvent[][];
  generatedAt: string;
}) {
  const events = input.timelines.flat().sort((left, right) => left.dayOffset - right.dayOffset);
  return {
    storeId: input.storeId,
    events,
    generatedAt: input.generatedAt,
  };
}
