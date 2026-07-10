import type { ExecutiveSourceEngine } from "@prisma/client";

import {
  getQuickWinDecisionMapping,
  PATTERN_DECISION_MAP,
  PROFIT_MARGIN_ESTIMATE,
} from "../../shared/constants";
import type {
  DecisionContextBundle,
  ScoredExecutiveDecision,
} from "../../shared/types";

export function buildDecisionsFromContext(
  context: DecisionContextBundle,
): ScoredExecutiveDecision[] {
  const decisions: ScoredExecutiveDecision[] = [];

  for (const win of context.quickWins) {
    const mapping = getQuickWinDecisionMapping(win.winType);
    if (!mapping) {
      continue;
    }

    const revenueImpact = win.revenueOpportunity;
    decisions.push({
      id: `quick-win:${win.winType}`,
      decisionKey: `quick_win:${win.winType}`,
      title: win.title,
      category: mapping.category,
      severity: mapping.severityFromUrgency(win.urgency),
      priority: Math.round(win.rankScore),
      businessImpact: win.businessImpact,
      confidence: win.confidence,
      urgency: win.urgency,
      estimatedRevenueImpact: revenueImpact,
      estimatedProfitImpact: roundCurrency(revenueImpact * PROFIT_MARGIN_ESTIMATE),
      estimatedEffort: win.affectedCount > 10 ? 3 : win.affectedCount > 3 ? 2 : 1,
      estimatedTimeMinutes: estimateTimeMinutes(win.affectedCount, mapping.category),
      recommendation: mapping.recommendation,
      evidenceIds: win.evidenceIds,
      graphNodeIds: [],
      relatedProducts: [],
      relatedCollections: [],
      relatedVendors: [],
      businessMemoryIds: [],
      historicalContext: {
        sourceFactTypes: win.sourceFactTypes,
        affectedCount: win.affectedCount,
        quickWinCategory: win.category,
      },
      sourceEngine: "quick_wins" satisfies ExecutiveSourceEngine,
      rankScore: win.rankScore,
      generatedAt: new Date().toISOString(),
    });
  }

  for (const seed of context.patternSeeds) {
    const mapping = PATTERN_DECISION_MAP.find(
      (item) => item.patternType === seed.patternType,
    );
    if (!mapping) {
      continue;
    }

    const revenueBaseline = context.merchantBaselines.find(
      (baseline) => baseline.baselineType === "revenue",
    );
    const averageOrderValue =
      typeof revenueBaseline?.baselineJson.averageOrderValue === "number"
        ? revenueBaseline.baselineJson.averageOrderValue
        : 75;
    const revenueImpact = roundCurrency(
      averageOrderValue * seed.confidence * 0.5,
    );

    decisions.push({
      id: `pattern:${seed.patternType}:${seed.semanticLabel}`,
      decisionKey: `pattern:${seed.patternType}:${seed.semanticLabel}`,
      title: mapping.title(seed.semanticLabel),
      category: mapping.category,
      severity: seed.confidence >= 0.85 ? "high" : "medium",
      priority: Math.round(seed.confidence * 100),
      businessImpact: Math.round(seed.confidence * 80),
      confidence: seed.confidence,
      urgency: Math.round(seed.confidence * 70),
      estimatedRevenueImpact: revenueImpact,
      estimatedProfitImpact: roundCurrency(revenueImpact * PROFIT_MARGIN_ESTIMATE),
      estimatedEffort: 2,
      estimatedTimeMinutes: 45,
      recommendation: mapping.recommendation,
      evidenceIds: [],
      graphNodeIds: [],
      relatedProducts: [],
      relatedCollections: [],
      relatedVendors: [],
      businessMemoryIds: [seed.id],
      historicalContext: seed.patternJson,
      sourceEngine: "pattern_discovery" satisfies ExecutiveSourceEngine,
      rankScore: roundScore(seed.confidence * 100),
      generatedAt: new Date().toISOString(),
    });
  }

  return decisions;
}

function estimateTimeMinutes(affectedCount: number, category: string): number {
  const base = category === "inventory" ? 20 : category === "seo" ? 10 : 15;
  return Math.min(180, base + affectedCount * 3);
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}
