import type { Prisma } from "@prisma/client";

import prisma from "../../../db.server";
import { buildQuickWinCandidates } from "./candidate-builder";
import { loadEvidenceForQuickWins } from "../shared/evidence-loader";
import { estimateAverageOrderValue, sumRevenueOpportunity } from "../impact/impact-estimator";
import { scoreQuickWinCandidates } from "../scoring/quick-win-scoring";
import { prioritizeForTrial, buildTrialHighlights } from "../ranking/quick-win-ranking";
import type { QuickWinGenerationResult, ScoredQuickWin } from "../shared/types";

export async function runQuickWinsGenerator(
  storeId: string,
): Promise<QuickWinGenerationResult> {
  const [groups, revenueBaseline, readiness] = await Promise.all([
    loadEvidenceForQuickWins(storeId),
    prisma.merchantBaseline.findFirst({
      where: { storeId, baselineType: "revenue" },
      orderBy: { computedAt: "desc" },
      select: { baselineJson: true },
    }),
    prisma.learningReadiness.findUnique({ where: { storeId } }),
  ]);

  const evidenceRows = await prisma.evidence.findMany({
    where: { storeId, active: true },
    select: {
      id: true,
      factType: true,
      entityId: true,
      confidence: true,
    },
  });

  const normalizedRows = evidenceRows.map((row) => ({
    id: row.id,
    factType: row.factType,
    entityId: row.entityId,
    confidence: Number(row.confidence),
  }));

  const candidates = buildQuickWinCandidates({
    groups,
    evidenceRows: normalizedRows,
  });

  const averageOrderValue = estimateAverageOrderValue(revenueBaseline?.baselineJson);
  const scored = scoreQuickWinCandidates(candidates, averageOrderValue);
  const prioritized = prioritizeForTrial(scored);
  const estimatedRevenueOpportunity = sumRevenueOpportunity(prioritized);

  await persistQuickWins(storeId, prioritized, estimatedRevenueOpportunity);
  await advanceReadinessToOperational(storeId, readiness?.overallConfidencePercent ?? 0);

  return {
    success: true,
    storeId,
    totalWins: prioritized.length,
    estimatedRevenueOpportunity,
    wins: prioritized,
  };
}

async function persistQuickWins(
  storeId: string,
  wins: ScoredQuickWin[],
  estimatedRevenueOpportunity: number,
): Promise<void> {
  const highlights = buildTrialHighlights(wins);
  const headline =
    highlights.length > 0
      ? `We already found ${highlights.length} high-impact opportunities from your store data.`
      : "Quick wins will appear as evidence accumulates.";

  await prisma.$transaction(async (tx) => {
    await tx.quickWin.updateMany({
      where: { storeId },
      data: { active: false },
    });

    for (const win of wins) {
      await tx.quickWin.upsert({
        where: {
          storeId_winType: {
            storeId,
            winType: win.winType,
          },
        },
        create: {
          storeId,
          winType: win.winType,
          category: win.category,
          title: win.title,
          description: win.description,
          affectedCount: win.affectedCount,
          businessImpact: win.businessImpact,
          estimatedEffort: win.estimatedEffort,
          confidence: win.confidence,
          revenueOpportunity: win.revenueOpportunity,
          urgency: win.urgency,
          rankScore: win.rankScore,
          evidenceIds: win.evidenceIds as Prisma.InputJsonValue,
          sourceFactTypes: win.sourceFactTypes as Prisma.InputJsonValue,
          metadata: (win.metadata ?? {}) as Prisma.InputJsonValue,
          active: true,
        },
        update: {
          category: win.category,
          title: win.title,
          description: win.description,
          affectedCount: win.affectedCount,
          businessImpact: win.businessImpact,
          estimatedEffort: win.estimatedEffort,
          confidence: win.confidence,
          revenueOpportunity: win.revenueOpportunity,
          urgency: win.urgency,
          rankScore: win.rankScore,
          evidenceIds: win.evidenceIds as Prisma.InputJsonValue,
          sourceFactTypes: win.sourceFactTypes as Prisma.InputJsonValue,
          metadata: (win.metadata ?? {}) as Prisma.InputJsonValue,
          active: true,
        },
      });
    }

    await tx.quickWinSummary.upsert({
      where: { storeId },
      create: {
        storeId,
        totalWins: wins.length,
        estimatedRevenueOpportunity,
        topCategories: wins.slice(0, 5).map((win) => win.category) as Prisma.InputJsonValue,
        headline,
        lastGeneratedAt: new Date(),
      },
      update: {
        totalWins: wins.length,
        estimatedRevenueOpportunity,
        topCategories: wins.slice(0, 5).map((win) => win.category) as Prisma.InputJsonValue,
        headline,
        lastGeneratedAt: new Date(),
      },
    });
  });
}

async function advanceReadinessToOperational(
  storeId: string,
  overallConfidencePercent: number,
): Promise<void> {
  await prisma.learningReadiness.upsert({
    where: { storeId },
    create: {
      storeId,
      stage: "operational",
      overallConfidencePercent,
      merchantMessage:
        "Quick wins are ready. StorePilot found immediate revenue opportunities in your catalog.",
      stageExplanation:
        "Deterministic quick wins were generated from knowledge graph evidence and historical memory.",
      lastComputedAt: new Date(),
    },
    update: {
      stage: "operational",
      merchantMessage:
        "Quick wins are ready. StorePilot found immediate revenue opportunities in your catalog.",
      stageExplanation:
        "Deterministic quick wins were generated from knowledge graph evidence and historical memory.",
      lastComputedAt: new Date(),
    },
  });
}
