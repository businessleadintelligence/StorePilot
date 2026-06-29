import type { ExecutiveCooFacts } from "../facts/executive-coo-facts";
import type {
  ExecutiveCooEnrichedOutput,
  ExecutiveCooOutput,
  ExecutiveCooTopPriority,
  ExecutiveCooTopPriorityDraft,
} from "../schemas/executive-coo";
import { buildExecutiveCooDeliverableFields } from "../schemas/executive-coo";
import type { ExecutiveCooExecutionContext } from "./agent-execution-context";
import {
  buildExecutiveCooEvidenceCatalog,
  resolveExecutiveCooEvidenceFromKeys,
  sectionScoreForFocusArea,
  validateExecutiveCooEvidenceKeys,
} from "./executive-coo-evidence";
import {
  estimateExecutiveCooConversionLift,
  estimateExecutiveCooInventoryReduction,
  estimateExecutiveCooPriorityImpactForFacts,
  estimateExecutiveCooRevenueGain,
} from "./executive-coo-impact";
import {
  assignExecutiveCooPriorityGroupFromImpact,
  buildExecutiveCooFocusAreaGroups,
} from "./executive-coo-groups";
import { buildExecutiveCooHealthExplanation } from "./executive-coo-health";
import {
  buildExecutiveCooMerchantPreferenceProfile,
  deriveExecutiveCooOverallConfidence,
  deriveExecutiveCooOverallPriority,
  rankExecutiveCooTopPriorities,
  type RankedExecutiveCooTopPriorityDraft,
} from "./executive-coo-ranking";

const IMPLEMENTATION_TIME: Record<string, string> = {
  Easy: "1-3 days",
  Medium: "1-2 weeks",
  Hard: "3-6 weeks",
};

function buildVerification(
  facts: ExecutiveCooFacts,
  priority: ExecutiveCooTopPriorityDraft,
) {
  if (priority.focusArea === "Inventory" || priority.focusArea === "Fulfillment") {
    return {
      expectedMetric: "Inventory risk",
      expectedDirection: "Decrease" as const,
      expectedWindow: "21 days",
    };
  }

  if (priority.focusArea === "Revenue") {
    return {
      expectedMetric: "Revenue opportunity",
      expectedDirection: "Increase" as const,
      expectedWindow: "30 days",
    };
  }

  if (priority.focusArea === "Growth") {
    return {
      expectedMetric: "Growth score",
      expectedDirection: "Increase" as const,
      expectedWindow: "30 days",
    };
  }

  if (facts.inventoryRisk >= 60) {
    return {
      expectedMetric: "Inventory risk",
      expectedDirection: "Decrease" as const,
      expectedWindow: "21 days",
    };
  }

  return {
    expectedMetric: "Operations health score",
    expectedDirection: "Increase" as const,
    expectedWindow: "21 days",
  };
}

function buildPriorityTimeline(input: {
  detectedAt: string;
  existingTimeline?: Record<string, unknown>;
}) {
  const existing = input.existingTimeline ?? {};

  return {
    detected: String(existing.detected ?? input.detectedAt),
    created: String(existing.created ?? input.detectedAt),
    viewed: existing.viewed ? String(existing.viewed) : null,
    implemented: existing.implemented ? String(existing.implemented) : null,
    verifying: existing.verifying ? String(existing.verifying) : null,
    verified: existing.verified ? String(existing.verified) : null,
    closed: existing.closed ? String(existing.closed) : null,
  };
}

function buildStrategyInsights(facts: ExecutiveCooFacts) {
  return [
    {
      question: "Should the merchant stabilize inventory or chase revenue first?",
      answer: facts.merchantOperationalPreferences.prefersInventoryFirst
        ? "Inventory stabilization should lead because stock and fulfillment risk is elevated."
        : "Revenue recovery can lead while inventory risk remains manageable.",
      confidence: 0.84,
    },
    {
      question: "Are specialist agents aligned enough for a coordinated push?",
      answer:
        facts.strategySignals.conflictingAgentCount === 0
          ? `${facts.strategySignals.alignedAgentCount} specialist agents are aligned on the current operating picture.`
          : `${facts.strategySignals.conflictingAgentCount} agents report elevated risk and need executive sequencing.`,
      confidence: facts.strategySignals.conflictingAgentCount === 0 ? 0.88 : 0.72,
    },
    {
      question: "Is growth acceleration ready now?",
      answer: facts.merchantOperationalPreferences.prefersGrowthAcceleration
        ? "Growth acceleration is viable once immediate operational blockers are cleared."
        : "Growth initiatives should wait until inventory and revenue stabilization improve.",
      confidence: facts.growthScore >= 60 ? 0.82 : 0.68,
    },
    {
      question: "Which operating motion should run first?",
      answer:
        facts.strategySignals.immediateWinCount >= facts.strategySignals.strategicOpportunityCount
          ? "Immediate cross-agent wins can stabilize operations faster than long-term bets."
          : "Strategic sequencing should lead while quick wins reduce operational drag.",
      confidence: 0.8,
    },
  ];
}

function dedupeSimilarExecutiveCooPriorities(
  priorities: ExecutiveCooTopPriorityDraft[],
): ExecutiveCooTopPriorityDraft[] {
  const seen = new Set<string>();
  const result: ExecutiveCooTopPriorityDraft[] = [];

  for (const priority of priorities) {
    const key = `${priority.focusArea}:${priority.title.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(priority);
  }

  return result;
}

export function enrichExecutiveCooOutput(input: {
  facts: ExecutiveCooFacts;
  output: ExecutiveCooOutput;
  executionContext?: ExecutiveCooExecutionContext;
  detectedAt?: string;
}): ExecutiveCooEnrichedOutput {
  const catalog =
    input.executionContext?.evidenceCatalog ?? buildExecutiveCooEvidenceCatalog(input.facts);
  const detectedAt = input.detectedAt ?? input.facts.computedAt;
  const preferences = input.executionContext?.recommendationRecords
    ? buildExecutiveCooMerchantPreferenceProfile(input.executionContext.recommendationRecords)
    : undefined;

  for (const priority of input.output.topPriorities) {
    validateExecutiveCooEvidenceKeys(priority.evidenceKeys, catalog);
  }

  const dedupedDrafts = dedupeSimilarExecutiveCooPriorities(input.output.topPriorities);
  const impacts = new Map(
    dedupedDrafts.map((priority) => [
      priority.id,
      estimateExecutiveCooPriorityImpactForFacts(input.facts, priority),
    ]),
  );

  const ranked = rankExecutiveCooTopPriorities({
    facts: input.facts,
    priorities: dedupedDrafts,
    impacts,
    preferences,
  });

  const enrichedPriorities: ExecutiveCooTopPriority[] = ranked.map(
    (priority: RankedExecutiveCooTopPriorityDraft, index) => {
      const impact = impacts.get(priority.id) ?? {};
      const group = assignExecutiveCooPriorityGroupFromImpact({
        focusArea: priority.focusArea,
        priorityScore: priority.priorityScore,
        impact,
      });
      const sectionScore = sectionScoreForFocusArea(input.facts, priority.focusArea);

      return {
        ...priority,
        priority: Math.min(5, index + 1),
        priorityScore: priority.priorityScore,
        estimatedImpactMetrics: impact,
        evidence: resolveExecutiveCooEvidenceFromKeys(priority.evidenceKeys, catalog),
        verification: buildVerification(input.facts, priority),
        group,
        priorityTimeline: buildPriorityTimeline({ detectedAt }),
        tasks: priority.merchantAction.map((action: string) => action.trim()).filter(Boolean),
        estimatedRevenueGain: estimateExecutiveCooRevenueGain(impact, sectionScore),
        estimatedInventoryReduction: estimateExecutiveCooInventoryReduction(impact),
        estimatedConversionLift: estimateExecutiveCooConversionLift(impact, sectionScore),
        estimatedImplementationTime: IMPLEMENTATION_TIME[priority.difficulty] ?? "1-2 weeks",
      };
    },
  );

  const focusAreaGroups = buildExecutiveCooFocusAreaGroups(
    enrichedPriorities.map((priority) => ({
      id: priority.id,
      group: priority.group,
    })),
  );

  const deliverableFields = buildExecutiveCooDeliverableFields({
    facts: {
      operationsHealthScore: input.facts.operationsHealthScore,
      revenueOpportunity: input.facts.revenueOpportunity,
      inventoryRisk: input.facts.inventoryRisk,
    },
    topPriorities: enrichedPriorities.map((priority) => ({
      id: priority.id,
      title: priority.title,
      group: priority.group,
      priority: priority.priority,
    })),
    findings: input.output.findings,
  });

  return {
    ...input.output,
    ...deliverableFields,
    operationsHealthScore: input.facts.operationsHealthScore,
    priority: deriveExecutiveCooOverallPriority(ranked.map((item) => item.priorityScore)),
    confidence: deriveExecutiveCooOverallConfidence(ranked.map((item) => item.confidence)),
    healthExplanation: buildExecutiveCooHealthExplanation(input.facts),
    focusAreaGroups,
    topPriorities: enrichedPriorities,
    executionSequence: enrichedPriorities.map((priority) => priority.id),
    strategyInsights: buildStrategyInsights(input.facts),
  };
}

export function mutateAndEnrichExecutiveCooOutput(input: {
  facts: ExecutiveCooFacts;
  output: ExecutiveCooOutput;
  executionContext?: ExecutiveCooExecutionContext;
}): ExecutiveCooEnrichedOutput {
  const enriched = enrichExecutiveCooOutput(input);

  Object.assign(input.output, {
    priority: enriched.priority,
    confidence: enriched.confidence,
    operationsHealthScore: enriched.operationsHealthScore,
    healthExplanation: enriched.healthExplanation,
    focusAreaGroups: enriched.focusAreaGroups,
    topPriorities: enriched.topPriorities,
    executionSequence: enriched.executionSequence,
    criticalOperationalRisks: enriched.criticalOperationalRisks,
    quickOperationalWins: enriched.quickOperationalWins,
    strategicOpportunities: enriched.strategicOpportunities,
    revenueOpportunity: enriched.revenueOpportunity,
    inventoryRisk: enriched.inventoryRisk,
    operationsTimeline: enriched.operationsTimeline,
    strategyInsights: enriched.strategyInsights,
  });

  return enriched;
}
