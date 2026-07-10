import type { Prisma } from "@prisma/client";

import prisma from "../../db.server";
import {
  buildBusinessContext,
  hashBusinessContext,
} from "../business-context/business-context-builder";
import { loadDecisionContext } from "../decision-context/decision-context-loader";
import { buildDecisionsFromContext } from "../decision-engine/decision-builder/decision-builder";
import { selectTopExecutiveDecisions } from "../decision-engine/decision-ranking/decision-ranking";
import { scoreExecutiveDecisions } from "../decision-engine/decision-scoring/decision-scoring";
import { computeOperationalReadiness } from "../executive-score/operational-readiness";
import { convertDecisionsToTasks } from "../operations-queue/task-converter";
import type {
  ExecutiveDecisionEngineResult,
  ScoredExecutiveDecision,
} from "../shared/types";

export async function runExecutiveDecisionEngine(
  storeId: string,
): Promise<ExecutiveDecisionEngineResult> {
  const context = await loadDecisionContext(storeId);
  const rawDecisions = buildDecisionsFromContext(context);
  const scored = scoreExecutiveDecisions(rawDecisions, context);
  const prioritized = selectTopExecutiveDecisions(scored);
  const operationalReadiness = computeOperationalReadiness(context);
  const businessContext = buildBusinessContext({
    context,
    decisions: prioritized,
    operationalReadiness,
  });
  const contextHash = hashBusinessContext(businessContext);

  const snapshot = await persistExecutiveDecisionEngine({
    storeId,
    decisions: prioritized,
    operationalReadiness,
    businessContext,
    contextHash,
    executiveCooReady: operationalReadiness.score >= 50 && prioritized.length > 0,
  });

  return {
    success: true,
    storeId,
    decisionCount: prioritized.length,
    taskCount: prioritized.length,
    operationalReadinessScore: operationalReadiness.score,
    contextSnapshotId: snapshot.id,
    executiveCooReady: operationalReadiness.score >= 50 && prioritized.length > 0,
  };
}

async function persistExecutiveDecisionEngine(input: {
  storeId: string;
  decisions: ScoredExecutiveDecision[];
  operationalReadiness: ReturnType<typeof computeOperationalReadiness>;
  businessContext: ReturnType<typeof buildBusinessContext>;
  contextHash: string;
  executiveCooReady: boolean;
}): Promise<{ id: string }> {
  const tasks = convertDecisionsToTasks(input.decisions);

  return prisma.$transaction(async (tx) => {
    await tx.executiveDecision.updateMany({
      where: { storeId: input.storeId },
      data: { active: false },
    });

    const decisionIdByKey = new Map<string, string>();

    for (const decision of input.decisions) {
      const row = await tx.executiveDecision.upsert({
        where: {
          storeId_decisionKey: {
            storeId: input.storeId,
            decisionKey: decision.decisionKey,
          },
        },
        create: mapDecisionCreate(input.storeId, decision),
        update: mapDecisionUpdate(decision),
      });
      decisionIdByKey.set(decision.decisionKey, row.id);

      await tx.decisionScore.create({
        data: {
          storeId: input.storeId,
          decisionId: row.id,
          scoreType: "rank",
          scoreValue: decision.rankScore,
          scoreJson: {
            businessImpact: decision.businessImpact,
            urgency: decision.urgency,
            confidence: decision.confidence,
          } as Prisma.InputJsonValue,
        },
      });

      await tx.decisionHistory.create({
        data: {
          storeId: input.storeId,
          decisionId: row.id,
          changeType: "generated",
          snapshot: decision as unknown as Prisma.InputJsonValue,
        },
      });
    }

    await tx.decisionTask.deleteMany({
      where: {
        storeId: input.storeId,
        status: "pending",
      },
    });

    for (const task of tasks) {
      const decisionRow = input.decisions.find((item) => item.title === task.title);
      const decisionId = decisionRow
        ? decisionIdByKey.get(decisionRow.decisionKey)
        : undefined;

      if (!decisionId) {
        continue;
      }

      await tx.decisionTask.create({
        data: {
          storeId: input.storeId,
          decisionId,
          title: task.title,
          description: task.description,
          reason: task.reason,
          evidenceIds: task.evidenceIds as Prisma.InputJsonValue,
          graphNodeIds: task.graphNodeIds as Prisma.InputJsonValue,
          businessMemoryIds: task.businessMemoryIds as Prisma.InputJsonValue,
          businessImpact: task.businessImpact,
          estimatedEffort: task.estimatedEffort,
          estimatedTimeMinutes: task.estimatedTimeMinutes,
          confidence: task.confidence,
        },
      });
    }

    await tx.operationalReadiness.upsert({
      where: { storeId: input.storeId },
      create: {
        storeId: input.storeId,
        ...input.operationalReadiness,
        scoreJson: input.operationalReadiness as unknown as Prisma.InputJsonValue,
      },
      update: {
        ...input.operationalReadiness,
        scoreJson: input.operationalReadiness as unknown as Prisma.InputJsonValue,
        lastComputedAt: new Date(),
      },
    });

    const latestSnapshot = await tx.businessContextSnapshot.findFirst({
      where: { storeId: input.storeId },
      orderBy: { versionNumber: "desc" },
      select: { versionNumber: true },
    });

    const snapshot = await tx.businessContextSnapshot.create({
      data: {
        storeId: input.storeId,
        versionNumber: (latestSnapshot?.versionNumber ?? 0) + 1,
        contextJson: input.businessContext as unknown as Prisma.InputJsonValue,
        contextHash: input.contextHash,
      },
    });

    if (input.executiveCooReady) {
      await tx.learningReadiness.updateMany({
        where: { storeId: input.storeId },
        data: {
          executiveCooReady: true,
          stage: "predictive",
          merchantMessage:
            "Executive COO is ready. Your daily operating plan and briefing are available.",
          stageExplanation:
            "Deterministic executive decisions and business context have been generated.",
          lastComputedAt: new Date(),
        },
      });
    } else {
      await tx.learningReadiness.updateMany({
        where: { storeId: input.storeId },
        data: {
          executiveCooReady: false,
          lastComputedAt: new Date(),
        },
      });
    }

    return snapshot;
  });
}

function mapDecisionCreate(
  storeId: string,
  decision: ScoredExecutiveDecision,
): Prisma.ExecutiveDecisionCreateInput {
  return {
    store: { connect: { id: storeId } },
    decisionKey: decision.decisionKey,
    title: decision.title,
    category: decision.category,
    severity: decision.severity,
    priority: decision.priority,
    businessImpact: decision.businessImpact,
    confidence: decision.confidence,
    urgency: decision.urgency,
    estimatedRevenueImpact: decision.estimatedRevenueImpact,
    estimatedProfitImpact: decision.estimatedProfitImpact,
    estimatedEffort: decision.estimatedEffort,
    estimatedTimeMinutes: decision.estimatedTimeMinutes,
    recommendation: decision.recommendation,
    evidenceIds: decision.evidenceIds as Prisma.InputJsonValue,
    graphNodeIds: decision.graphNodeIds as Prisma.InputJsonValue,
    relatedProducts: decision.relatedProducts as Prisma.InputJsonValue,
    relatedCollections: decision.relatedCollections as Prisma.InputJsonValue,
    relatedVendors: decision.relatedVendors as Prisma.InputJsonValue,
    businessMemoryIds: decision.businessMemoryIds as Prisma.InputJsonValue,
    historicalContext: decision.historicalContext as Prisma.InputJsonValue,
    sourceEngine: decision.sourceEngine,
    rankScore: decision.rankScore,
    active: true,
    generatedAt: new Date(decision.generatedAt),
  };
}

function mapDecisionUpdate(
  decision: ScoredExecutiveDecision,
): Prisma.ExecutiveDecisionUpdateInput {
  return {
    title: decision.title,
    category: decision.category,
    severity: decision.severity,
    priority: decision.priority,
    businessImpact: decision.businessImpact,
    confidence: decision.confidence,
    urgency: decision.urgency,
    estimatedRevenueImpact: decision.estimatedRevenueImpact,
    estimatedProfitImpact: decision.estimatedProfitImpact,
    estimatedEffort: decision.estimatedEffort,
    estimatedTimeMinutes: decision.estimatedTimeMinutes,
    recommendation: decision.recommendation,
    evidenceIds: decision.evidenceIds as Prisma.InputJsonValue,
    graphNodeIds: decision.graphNodeIds as Prisma.InputJsonValue,
    relatedProducts: decision.relatedProducts as Prisma.InputJsonValue,
    relatedCollections: decision.relatedCollections as Prisma.InputJsonValue,
    relatedVendors: decision.relatedVendors as Prisma.InputJsonValue,
    businessMemoryIds: decision.businessMemoryIds as Prisma.InputJsonValue,
    historicalContext: decision.historicalContext as Prisma.InputJsonValue,
    sourceEngine: decision.sourceEngine,
    rankScore: decision.rankScore,
    active: true,
    generatedAt: new Date(decision.generatedAt),
  };
}
