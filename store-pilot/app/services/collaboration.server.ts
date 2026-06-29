import { randomUUID } from "node:crypto";
import prisma from "../db.server";
import { calculateStoreHealthScore } from "./health-score.server";
import { getStoreMetrics } from "./metrics.server";
import { createPrismaAIPersistence } from "../ai/persistence/prisma-persistence";
import type { AIPersistenceRepositories } from "../ai/persistence/types";
import { runCollaborationEngine } from "../ai/collaboration/collaboration-engine";
import {
  buildCollaborationContextFromInputs,
  buildCollaborationMemoryFromRecords,
  mapAgentResultSnapshot,
  mapRecommendationRecord,
} from "../ai/collaboration/collaboration-context";
import { buildCollaborationSubjectKey } from "../ai/collaboration/collaboration-utils";
import {
  loadLatestCollaborationOutputFromStore,
  persistCollaborationOutput,
} from "../ai/collaboration/collaboration-persistence";
import { buildCollaborationChartData } from "../ai/collaboration/collaboration-timeline";
import type { CollaborationContext, CollaborationOutput } from "../ai/collaboration/collaboration-types";
import { processCollaborationLifecycle } from "./collaboration-lifecycle.server";
import { COLLABORATION_SOURCE_AGENTS } from "../ai/collaboration/collaboration-types";

export type ExecuteCollaborationInput = {
  storeId: string;
  persistence?: AIPersistenceRepositories;
  skipLifecycle?: boolean;
  force?: boolean;
};

export type ExecuteCollaborationResult = {
  status: "succeeded" | "skipped";
  runId: string | null;
  output: CollaborationOutput | null;
  charts: ReturnType<typeof buildCollaborationChartData> | null;
};

export async function loadCollaborationContext(storeId: string): Promise<CollaborationContext> {
  const subjectKey = buildCollaborationSubjectKey(storeId);

  const [metrics, recommendationRecords, agentResults, collaborationRecords] = await Promise.all([
    getStoreMetrics(storeId),
    prisma.aiRecommendation.findMany({
      where: {
        storeId,
        agentId: { in: [...COLLABORATION_SOURCE_AGENTS] },
        status: { in: ["open", "viewed", "implemented", "dismissed", "verified", "closed"] },
      },
      orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
      take: 200,
    }),
    Promise.all(
      COLLABORATION_SOURCE_AGENTS.map((agentId) =>
        prisma.aiAgentResult.findFirst({
          where: { storeId, agentId, isSuccess: true },
          orderBy: { createdAt: "desc" },
          select: {
            agentId: true,
            subjectKey: true,
            summary: true,
            confidence: true,
            resultJson: true,
            createdAt: true,
          },
        }),
      ),
    ),
    prisma.aiRecommendation.findMany({
      where: { storeId, subjectKey },
      select: { status: true, payloadJson: true, stableId: true },
    }),
  ]);

  const productIds = recommendationRecords
    .map((record) => record.subjectKey.match(/^product:(.+)$/)?.[1] ?? null)
    .filter((value): value is string => Boolean(value));

  const products =
    productIds.length > 0
      ? await prisma.product.findMany({
          where: { storeId, id: { in: [...new Set(productIds)] } },
          select: { id: true, title: true },
        })
      : [];
  const productTitles = new Map(products.map((product) => [product.id, product.title]));

  const recommendations = recommendationRecords
    .map((record) =>
      mapRecommendationRecord({
        ...record,
        productTitle: productTitles.get(record.subjectKey.match(/^product:(.+)$/)?.[1] ?? "") ?? null,
      }),
    )
    .filter((record): record is NonNullable<typeof record> => record != null);

  const memory = buildCollaborationMemoryFromRecords([
    ...recommendationRecords.map((record) => ({
      status: record.status,
      payloadJson: record.payloadJson,
      stableId: record.stableId,
    })),
    ...collaborationRecords,
  ]);

  const storeHealthScore = calculateStoreHealthScore(metrics);

  return buildCollaborationContextFromInputs({
    storeId,
    recommendations,
    agentResults: agentResults
      .filter((record): record is NonNullable<typeof record> => record != null)
      .map((record) => mapAgentResultSnapshot(record))
      .filter((record): record is NonNullable<typeof record> => record != null),
    memory,
    storeMetrics: {
      storeHealth: storeHealthScore.score,
      revenueHealth: Math.min(100, Math.round(metrics.averageOrderValue * 4)),
      inventoryHealth: Math.max(
        0,
        100 - metrics.outOfStockProducts * 8 - metrics.lowStockProducts * 3,
      ),
      growthScore: Math.min(100, Math.round(metrics.orders / Math.max(metrics.activeProducts, 1))),
    },
  });
}

export async function executeCollaboration(
  input: ExecuteCollaborationInput,
): Promise<ExecuteCollaborationResult> {
  const persistence = input.persistence ?? createPrismaAIPersistence();
  const subjectKey = buildCollaborationSubjectKey(input.storeId);
  const context = await loadCollaborationContext(input.storeId);

  if (!input.skipLifecycle) {
    await processCollaborationLifecycle({
      storeId: input.storeId,
      subjectKey,
      context,
      persistence,
    });
  }

  if (context.recommendations.length === 0) {
    const cached = await loadLatestCollaborationOutputFromStore({ storeId: input.storeId });
    return {
      status: "skipped",
      runId: null,
      output: cached,
      charts: cached ? buildCollaborationChartData(cached) : null,
    };
  }

  const output = runCollaborationEngine(context);
  const runId = randomUUID();

  await persistCollaborationOutput({
    storeId: input.storeId,
    runId,
    output,
    persistence,
  });

  return {
    status: "succeeded",
    runId,
    output,
    charts: buildCollaborationChartData(output),
  };
}

export {
  buildCollaborationSubjectKey,
  loadLatestCollaborationOutputFromStore,
  buildCollaborationChartData,
};

export type {
  CollaborationContext,
  CollaborationOutput,
} from "../ai/collaboration/collaboration-types";
