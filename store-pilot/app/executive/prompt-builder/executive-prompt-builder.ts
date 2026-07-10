import type {
  BusinessContextPayload,
  DailyOperatingPlanPayload,
  ExecutiveBriefingPayload,
  ScoredExecutiveDecision,
} from "../shared/types";

export function buildExecutiveCooPrompt(context: BusinessContextPayload): string {
  const compact = {
    summary: context.businessSummary,
    health: context.storeHealth,
    dna: summarizeObject(context.businessDna, 8),
    topRisks: context.topRisks.slice(0, 5),
    topOpportunities: context.topOpportunities.slice(0, 5),
    priorityDecisions: context.priorityDecisions.slice(0, 8).map((decision) => ({
      title: decision.title,
      category: decision.category,
      severity: decision.severity,
      revenueImpact: decision.estimatedRevenueImpact,
      confidence: decision.confidence,
      recommendation: decision.recommendation,
    })),
    operationalReadiness: context.operationalReadiness,
    historicalPatterns: context.historicalContext.patterns,
    merchantPriorities: context.merchantProfile.learningPriorities,
    recentChanges: context.recentChanges.slice(0, 5),
    rootCauseAnalysis: context.rootCauseAnalysis ?? [],
    predictionAnalysis: context.predictionAnalysis ?? [],
    preventionRecommendations: context.preventionRecommendations ?? [],
    businessStability: context.businessStability ?? { score: 0 },
    experimentSummary: context.experimentSummary ?? {},
    experimentRecommendations: context.experimentRecommendations ?? [],
    merchantIntelligence: context.merchantIntelligence ?? {},
  };

  return JSON.stringify(compact);
}

export function buildDeterministicBriefing(
  context: BusinessContextPayload,
): ExecutiveBriefingPayload {
  const topDecision = context.priorityDecisions[0];
  const revenueBaseline = context.merchantProfile.revenueBaseline as Record<
    string,
    unknown
  >;

  return {
    headline: topDecision
      ? `Top priority: ${topDecision.title}`
      : "Business intelligence is ready",
    greeting: "Good morning. Here's your overnight business briefing.",
    sections: [
      {
        key: "revenue_summary",
        title: "Revenue Summary",
        content: formatRevenueSummary(revenueBaseline, context),
        priority: 1,
      },
      {
        key: "operational_readiness",
        title: "Operational Readiness",
        content: `Operational Readiness score is ${context.operationalReadiness.score}/100.`,
        priority: 2,
      },
      {
        key: "inventory_risks",
        title: "Inventory Risks",
        content: summarizeCategory(context.priorityDecisions, "inventory"),
        priority: 3,
      },
      {
        key: "pricing_opportunities",
        title: "Pricing Opportunities",
        content: summarizeCategory(context.priorityDecisions, "pricing"),
        priority: 4,
      },
      {
        key: "seo_status",
        title: "SEO Status",
        content: summarizeCategory(context.priorityDecisions, "seo"),
        priority: 5,
      },
      {
        key: "growth_signals",
        title: "Growth Signals",
        content: summarizeCategory(context.priorityDecisions, "growth"),
        priority: 6,
      },
      {
        key: "refund_watch",
        title: "Refund Watch",
        content: summarizeCategory(context.priorityDecisions, "operations"),
        priority: 7,
      },
    ],
    topPriority: topDecision?.title ?? "No critical priorities detected",
    todaysFocus: context.priorityDecisions.slice(0, 3).map((decision) => decision.title),
    businessOutlook:
      context.operationalReadiness.score >= 70
        ? "Stable operations with actionable improvement opportunities."
        : "Operational attention required on high-impact priorities.",
  };
}

export function buildDeterministicOperatingPlan(
  decisions: ScoredExecutiveDecision[],
): DailyOperatingPlanPayload {
  const tasks = decisions.slice(0, 8).map((decision) => ({
    decisionId: decision.id,
    title: decision.title,
    description: decision.recommendation,
    reason: Array.isArray(decision.historicalContext.sourceFactTypes)
      ? `Evidence: ${(decision.historicalContext.sourceFactTypes as string[]).join(", ")}`
      : `Source: ${decision.sourceEngine}`,
    evidenceIds: decision.evidenceIds,
    businessImpact: decision.businessImpact,
    estimatedEffort: decision.estimatedEffort,
    estimatedTimeMinutes: decision.estimatedTimeMinutes,
    confidence: decision.confidence,
    actions: ["approve", "ignore", "learn_more"] as Array<
      "approve" | "ignore" | "learn_more"
    >,
  }));

  const estimatedRevenueOpportunity = roundCurrency(
    tasks.reduce((sum, task) => {
      const decision = decisions.find((item) => item.id === task.decisionId);
      return sum + (decision?.estimatedRevenueImpact ?? 0);
    }, 0),
  );
  const estimatedProfitOpportunity = roundCurrency(
    estimatedRevenueOpportunity * 0.35,
  );
  const estimatedCompletionMinutes = tasks.reduce(
    (sum, task) => sum + task.estimatedTimeMinutes,
    0,
  );

  return {
    title: "Today's Business Plan",
    estimatedCompletionMinutes,
    estimatedRevenueOpportunity,
    estimatedProfitOpportunity,
    taskCount: tasks.length,
    tasks,
  };
}

function summarizeCategory(
  decisions: ScoredExecutiveDecision[],
  category: string,
): string {
  const matches = decisions.filter((decision) => decision.category === category);
  if (matches.length === 0) {
    return "No active signals in this area.";
  }
  return matches
    .slice(0, 3)
    .map((decision) => decision.title)
    .join("; ");
}

function formatRevenueSummary(
  revenueBaseline: Record<string, unknown>,
  context: BusinessContextPayload,
): string {
  const totalRevenue =
    typeof revenueBaseline.totalRevenue === "number"
      ? revenueBaseline.totalRevenue
      : null;
  const opportunity =
    typeof context.businessSummary.estimatedRevenueOpportunity === "number"
      ? context.businessSummary.estimatedRevenueOpportunity
      : 0;

  if (totalRevenue !== null) {
    return `Recorded revenue baseline ${totalRevenue}. Identified opportunity ${opportunity}/month.`;
  }
  return `Identified revenue opportunity ${opportunity}/month from structured decisions.`;
}

function summarizeObject(
  value: Record<string, unknown>,
  maxKeys: number,
): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).slice(0, maxKeys));
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}
