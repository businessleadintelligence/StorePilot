import prisma from "../../db.server";
import { computeGraphStatistics } from "../../knowledge/graph/metrics/graph-metrics";
import { buildEvidenceFactGroups } from "../../learning/quick-wins/shared/evidence-loader";
import type { PredictionContextBundle } from "../shared/types";

export async function loadPredictionContext(
  storeId: string,
): Promise<PredictionContextBundle> {
  const [
    evidenceRows,
    patternSeeds,
    merchantBaselines,
    rootCauses,
    quickWins,
    graphStats,
  ] = await Promise.all([
    prisma.evidence.findMany({
      where: { storeId, active: true },
      select: { id: true, factType: true, entityId: true, confidence: true },
    }),
    prisma.patternSeed.findMany({ where: { storeId } }),
    prisma.merchantBaseline.findMany({ where: { storeId } }),
    prisma.rootCause.findMany({
      where: { storeId, active: true },
      orderBy: { rankScore: "desc" },
      take: 20,
    }),
    prisma.quickWin.findMany({ where: { storeId, active: true } }),
    computeGraphStatistics(storeId),
  ]);

  const groups = buildEvidenceFactGroups(
    evidenceRows.map((row) => ({
      id: row.id,
      factType: row.factType,
      entityId: row.entityId,
      confidence: Number(row.confidence),
    })),
  );

  const evidenceGroups = new Map<
    string,
    { count: number; evidenceIds: string[]; avgConfidence: number }
  >();
  for (const [factType, group] of groups) {
    evidenceGroups.set(factType, {
      count: group.count,
      evidenceIds: group.evidenceIds,
      avgConfidence: group.avgConfidence,
    });
  }

  return {
    storeId,
    evidenceGroups,
    patternSeeds: patternSeeds.map((seed) => ({
      id: seed.id,
      patternType: seed.patternType,
      semanticLabel: seed.semanticLabel,
      confidence: Number(seed.confidence),
      patternJson: (seed.patternJson ?? {}) as Record<string, unknown>,
    })),
    merchantBaselines: merchantBaselines.map((baseline) => ({
      id: baseline.id,
      baselineType: baseline.baselineType,
      baselineJson: (baseline.baselineJson ?? {}) as Record<string, unknown>,
    })),
    rootCauses: rootCauses.map((cause) => ({
      id: cause.id,
      businessOutcome: cause.businessOutcome,
      primaryCause: cause.primaryCause,
      confidence: Number(cause.confidence),
      evidenceIds: normalizeArray(cause.evidenceIds),
      timeline: Array.isArray(cause.timeline) ? cause.timeline : [],
    })),
    quickWins: quickWins.map((win) => ({
      id: win.id,
      winType: win.winType,
      title: win.title,
      affectedCount: win.affectedCount,
      revenueOpportunity: Number(win.revenueOpportunity),
      evidenceIds: normalizeArray(win.evidenceIds),
    })),
    graphStats: {
      totalNodes: graphStats.totalNodes,
      totalEdges: graphStats.totalEdges,
    },
  };
}

function normalizeArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}
