import prisma from "../../db.server";
import { computeGraphStatistics } from "../../knowledge/graph/metrics/graph-metrics";
import type { DecisionContextBundle } from "../shared/types";

export async function loadDecisionContext(
  storeId: string,
): Promise<DecisionContextBundle> {
  const [
    quickWins,
    quickWinSummary,
    patternSeeds,
    confidenceSeeds,
    merchantBaselines,
    businessDnaRow,
    historicalMemory,
    learningReadiness,
    learningPriorities,
    graphStats,
  ] = await Promise.all([
    prisma.quickWin.findMany({
      where: { storeId, active: true },
      orderBy: [{ rankScore: "desc" }],
    }),
    prisma.quickWinSummary.findUnique({ where: { storeId } }),
    prisma.patternSeed.findMany({ where: { storeId } }),
    prisma.confidenceSeed.findMany({ where: { storeId } }),
    prisma.merchantBaseline.findMany({ where: { storeId } }),
    prisma.businessDnaVersion.findFirst({
      where: { storeId },
      orderBy: { versionNumber: "desc" },
    }),
    prisma.historicalMemory.findUnique({ where: { storeId } }),
    prisma.learningReadiness.findUnique({ where: { storeId } }),
    prisma.learningPriority.findMany({
      where: { storeId },
      orderBy: { priorityOrder: "asc" },
    }),
    computeGraphStatistics(storeId),
  ]);

  return {
    storeId,
    quickWins: quickWins.map((win) => ({
      winType: win.winType,
      category: win.category,
      title: win.title,
      description: win.description,
      affectedCount: win.affectedCount,
      businessImpact: win.businessImpact,
      confidence: Number(win.confidence),
      urgency: win.urgency,
      revenueOpportunity: Number(win.revenueOpportunity),
      rankScore: Number(win.rankScore),
      evidenceIds: normalizeStringArray(win.evidenceIds),
      sourceFactTypes: normalizeStringArray(win.sourceFactTypes),
    })),
    quickWinSummary: quickWinSummary
      ? {
          totalWins: quickWinSummary.totalWins,
          estimatedRevenueOpportunity: Number(
            quickWinSummary.estimatedRevenueOpportunity,
          ),
          headline: quickWinSummary.headline,
        }
      : null,
    patternSeeds: patternSeeds.map((seed) => ({
      id: seed.id,
      patternType: seed.patternType,
      semanticLabel: seed.semanticLabel,
      confidence: Number(seed.confidence),
      patternJson: (seed.patternJson ?? {}) as Record<string, unknown>,
    })),
    confidenceSeeds: confidenceSeeds.map((seed) => ({
      domain: seed.domain,
      confidencePercent: seed.confidencePercent,
    })),
    merchantBaselines: merchantBaselines.map((baseline) => ({
      baselineType: baseline.baselineType,
      baselineJson: (baseline.baselineJson ?? {}) as Record<string, unknown>,
    })),
    businessDna: businessDnaRow
      ? ((businessDnaRow.dnaJson ?? {}) as Record<string, unknown>)
      : null,
    historicalMemory: historicalMemory
      ? ((historicalMemory.memoryJson ?? {}) as Record<string, unknown>)
      : null,
    learningReadiness: learningReadiness
      ? {
          stage: learningReadiness.stage,
          overallConfidencePercent: learningReadiness.overallConfidencePercent,
          executiveCooReady: learningReadiness.executiveCooReady,
          predictionReady: learningReadiness.predictionReady,
          experimentReady: learningReadiness.experimentReady,
          merchantIntelligenceReady: learningReadiness.merchantIntelligenceReady,
        }
      : null,
    learningPriorities: learningPriorities.map((priority) => ({
      domain: priority.domain,
      priorityOrder: priority.priorityOrder,
    })),
    graphStats: {
      totalNodes: graphStats.totalNodes,
      totalEdges: graphStats.totalEdges,
    },
  };
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}
