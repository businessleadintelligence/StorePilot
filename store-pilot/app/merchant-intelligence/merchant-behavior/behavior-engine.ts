import type { MerchantActionType } from "@prisma/client";

import type {
  DecisionJournalRecord,
  MerchantBehaviorRecord,
  MerchantIntelligenceContext,
} from "../shared/types";

export function detectMerchantBehavior(
  entries: DecisionJournalRecord[],
  context: MerchantIntelligenceContext,
): MerchantBehaviorRecord {
  const pricing = filterDomain(entries, ["pricing", "executive_decision"], "pricing");
  const inventory = filterDomain(entries, ["inventory"], "inventory");
  const seo = filterDomain(entries, ["seo"], "seo");
  const experiments = entries.filter((e) => e.decisionType === "experiment");
  const highConfidence = entries.filter((e) => e.confidenceBefore >= 0.85);

  const acceptRate = (items: DecisionJournalRecord[]) =>
    items.length === 0
      ? 0.5
      : items.filter((e) => isAccept(e.merchantAction)).length / items.length;

  const rejectRate = (items: DecisionJournalRecord[]) =>
    items.length === 0
      ? 0.5
      : items.filter((e) => isReject(e.merchantAction)).length / items.length;

  const weekendApprovals =
    experiments.filter((e) => isAccept(e.merchantAction)).length /
    Math.max(1, experiments.length);

  return {
    acceptsPricingChanges: round(acceptRate(pricing)),
    rejectsInventoryChanges: round(rejectRate(inventory)),
    ignoresSeo: round(rejectRate(seo) > 0.6 ? 0.7 : 0.3),
    prefersAutomation: round(context.patternSeeds.length > 2 ? 0.65 : 0.45),
    acceptsHighConfidenceOnly: round(
      highConfidence.length === 0
        ? 0.5
        : highConfidence.filter((e) => isAccept(e.merchantAction)).length /
            highConfidence.length,
    ),
    approvesWeekendExperiments: round(weekendApprovals),
    actsQuickly: round(entries.length > 5 ? 0.7 : 0.4),
    delaysDecisions: round(
      entries.filter((e) => e.merchantAction === "pending").length /
        Math.max(1, entries.length),
    ),
    prefersLowRisk: round(context.businessStabilityScore / 100),
    prefersLongTermGrowth: round(acceptRate(entries.filter((e) => e.revenueImpact > 0))),
    prefersOperationalEfficiency: round(
      context.executiveDecisions.filter((d) => d.category === "operations").length > 0
        ? 0.75
        : 0.5,
    ),
  };
}

function filterDomain(
  entries: DecisionJournalRecord[],
  types: string[],
  categoryHint: string,
): DecisionJournalRecord[] {
  return entries.filter(
    (e) =>
      types.includes(e.decisionType) ||
      String(e.businessContext.category ?? "").includes(categoryHint),
  );
}

function isAccept(action: MerchantActionType): boolean {
  return action === "accepted" || action === "approved" || action === "confirmed";
}

function isReject(action: MerchantActionType): boolean {
  return action === "rejected" || action === "dismissed" || action === "ignored";
}

function round(v: number): number {
  return Math.round(v * 10000) / 10000;
}
