import type { DecisionJournalRecord, TimelineEventRecord } from "../shared/types";

export function buildMerchantTimeline(
  entries: DecisionJournalRecord[],
  extras: {
    dnaVersion: number;
    memoryVersion: number;
    adaptiveScore: number;
  },
): TimelineEventRecord[] {
  const events: TimelineEventRecord[] = entries.map((entry) => ({
    eventKey: `timeline:${entry.journalKey}`,
    eventCategory: entry.decisionType,
    title: entry.title,
    eventJson: {
      merchantAction: entry.merchantAction,
      confidenceBefore: entry.confidenceBefore,
      confidenceAfter: entry.confidenceAfter,
      revenueImpact: entry.revenueImpact,
    },
    occurredAt: new Date().toISOString(),
  }));

  events.push({
    eventKey: `timeline:dna:v${extras.dnaVersion}`,
    eventCategory: "business_dna",
    title: `Business DNA updated to v${extras.dnaVersion}`,
    eventJson: { version: extras.dnaVersion },
    occurredAt: new Date().toISOString(),
  });

  events.push({
    eventKey: `timeline:memory:v${extras.memoryVersion}`,
    eventCategory: "business_memory",
    title: `Business Memory updated to v${extras.memoryVersion}`,
    eventJson: { version: extras.memoryVersion },
    occurredAt: new Date().toISOString(),
  });

  events.push({
    eventKey: `timeline:adaptive:${extras.adaptiveScore}`,
    eventCategory: "adaptive_score",
    title: `Adaptive Intelligence score: ${extras.adaptiveScore}`,
    eventJson: { score: extras.adaptiveScore },
    occurredAt: new Date().toISOString(),
  });

  return events;
}

export function buildDecisionTimelines(entries: DecisionJournalRecord[]) {
  return entries.map((entry) => ({
    timelineKey: `dt:${entry.journalKey}`,
    journalKey: entry.journalKey,
    eventType: `${entry.decisionType}:${entry.merchantAction}`,
    eventJson: {
      title: entry.title,
      outcome: entry.outcome,
      confidenceDelta: entry.confidenceAfter - entry.confidenceBefore,
    },
  }));
}
