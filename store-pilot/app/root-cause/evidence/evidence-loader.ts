import prisma from "../../db.server";
import { computeGraphStatistics } from "../../knowledge/graph/metrics/graph-metrics";
import { buildEvidenceFactGroups } from "../../learning/quick-wins/shared/evidence-loader";
import type { RootCauseContextBundle } from "../shared/types";

export async function loadRootCauseContext(
  storeId: string,
): Promise<RootCauseContextBundle> {
  const [
    evidenceRows,
    patternSeeds,
    quickWins,
    merchantBaselines,
    historicalMemory,
    businessDnaRow,
    graphStats,
  ] = await Promise.all([
    prisma.evidence.findMany({
      where: { storeId, active: true },
      select: { id: true, factType: true, entityId: true, confidence: true },
    }),
    prisma.patternSeed.findMany({ where: { storeId } }),
    prisma.quickWin.findMany({ where: { storeId, active: true } }),
    prisma.merchantBaseline.findMany({ where: { storeId } }),
    prisma.historicalMemory.findUnique({ where: { storeId } }),
    prisma.businessDnaVersion.findFirst({
      where: { storeId },
      orderBy: { versionNumber: "desc" },
    }),
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
    quickWins: quickWins.map((win) => ({
      id: win.id,
      winType: win.winType,
      title: win.title,
      evidenceIds: normalizeArray(win.evidenceIds),
      sourceFactTypes: normalizeArray(win.sourceFactTypes),
      revenueOpportunity: Number(win.revenueOpportunity),
      urgency: win.urgency,
      confidence: Number(win.confidence),
    })),
    merchantBaselines: merchantBaselines.map((baseline) => ({
      id: baseline.id,
      baselineType: baseline.baselineType,
      baselineJson: (baseline.baselineJson ?? {}) as Record<string, unknown>,
    })),
    historicalMemory: historicalMemory
      ? ((historicalMemory.memoryJson ?? {}) as Record<string, unknown>)
      : null,
    businessDna: businessDnaRow
      ? ((businessDnaRow.dnaJson ?? {}) as Record<string, unknown>)
      : null,
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
