import type { BusinessOutcomeType } from "@prisma/client";

import { OUTCOME_DETECTION_RULES } from "../shared/constants";
import { buildCausalChain, buildCausalGraphEdges } from "../causal-chain/chain-builder";
import { computeCauseConfidence } from "../confidence/confidence-scorer";
import { assessImpact, severityFromConfidence } from "../impact/impact-assessor";
import { computeRankScore } from "../ranking/cause-ranking";
import { rejectImpossibleCause, validateOutcomeRule } from "../rules/causal-rules";
import { getActiveSignalKeys } from "../signal-analysis/signal-analyzer";
import { buildCausalTimeline } from "../timeline/timeline-builder";
import { validateAgainstPatterns } from "../pattern-validation/pattern-validator";
import type {
  RootCauseContextBundle,
  RootCauseRecord,
  SignalSnapshot,
} from "../shared/types";

const OUTCOME_PATTERN_MAP: Partial<Record<BusinessOutcomeType, string[]>> = {
  revenue_decrease: ["order_growth", "revenue_decline_30d"],
  revenue_increase: ["order_growth", "revenue_growth_30d"],
  refund_spike: ["high_refund_rate"],
  inventory_shortage: ["inventory_pressure"],
  operational_bottleneck: ["inventory_pressure", "high_refund_rate"],
};

export function reasonAboutRootCauses(input: {
  context: RootCauseContextBundle;
  signals: SignalSnapshot[];
}): RootCauseRecord[] {
  const activeSignals = getActiveSignalKeys(input.signals);
  const causes: RootCauseRecord[] = [];

  for (const rule of OUTCOME_DETECTION_RULES) {
    if (!validateOutcomeRule(rule, activeSignals)) {
      continue;
    }

    const chain = buildCausalChain({
      rule,
      signals: input.signals,
      context: input.context,
    });

    const primaryDomain = chain[0]?.domain ?? "general";
    if (
      rejectImpossibleCause({
        primaryCauseDomain: primaryDomain,
        businessOutcome: rule.outcome,
      })
    ) {
      continue;
    }

    const patternValidation = validateAgainstPatterns({
      context: input.context,
      outcome: rule.outcome,
      patternTypes: OUTCOME_PATTERN_MAP[rule.outcome] ?? [],
    });

    if (!patternValidation.supported) {
      continue;
    }

    const evidenceIds = chain.flatMap((step) => step.evidenceIds);
    const confidenceBreakdown = computeCauseConfidence({
      evidenceIds,
      signals: input.signals,
      context: input.context,
      patternSupport: patternValidation.supportScore,
    });

    const relatedQuickWins = input.context.quickWins.filter((win) =>
      win.sourceFactTypes.some((factType) =>
        input.signals.some((signal) => signal.factTypes.includes(factType)),
      ),
    );

    const revenueOpportunity = relatedQuickWins.reduce(
      (sum, win) => sum + win.revenueOpportunity,
      0,
    );
    const urgency = relatedQuickWins.reduce((max, win) => Math.max(max, win.urgency), 40);

    const impactEstimate = assessImpact({
      revenueOpportunity,
      urgency,
      confidence: confidenceBreakdown.confidenceScore,
      affectedEvidenceCount: evidenceIds.length,
    });

    const timeline = buildCausalTimeline({
      chain,
      outcomeLabel: rule.outcome.replace(/_/g, " "),
    });

    const record: RootCauseRecord = {
      id: `root-cause:${rule.outcome}`,
      causeKey: `outcome:${rule.outcome}`,
      businessOutcome: rule.outcome,
      primaryCause: rule.primaryCauseTemplate,
      secondaryCauses: rule.optionalSignals ?? [],
      contributingFactors: patternValidation.matchedPatterns,
      confidence: confidenceBreakdown.confidenceScore,
      evidenceIds,
      graphNodeIds: buildCausalGraphEdges(chain).map((edge) => edge.edgeKey),
      businessMemoryIds: input.context.patternSeeds
        .filter((seed) => patternValidation.matchedPatterns.includes(seed.patternType))
        .map((seed) => seed.id),
      quickWinIds: relatedQuickWins.map((win) => win.id),
      merchantBaselineIds: input.context.merchantBaselines.map((baseline) => baseline.id),
      causalChain: chain,
      timeline,
      historicalSupport: {
        matchedPatterns: patternValidation.matchedPatterns,
        supportScore: patternValidation.supportScore,
      },
      impactEstimate,
      severity: severityFromConfidence(confidenceBreakdown.confidenceScore),
      urgency: impactEstimate.urgency,
      rankScore: 0,
      generatedAt: new Date().toISOString(),
    };

    record.rankScore = computeRankScore(record);
    causes.push(record);
  }

  return causes;
}
