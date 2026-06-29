import {
  getAIOrchestrator,
  AIOrchestrator,
  type AIOrchestratorDependencies,
  type AIOrchestratorExecuteInput,
  type AIOrchestratorExecuteResult,
} from "../ai/orchestrator/ai-orchestrator.server";
import {
  createGrowthIntelligenceFactsBuilder,
  type GrowthIntelligenceFactsSource,
} from "../ai/facts/growth-intelligence-facts";
import { createPrismaAIPersistence } from "../ai/persistence/prisma-persistence";
import type { AIPersistenceRepositories } from "../ai/persistence/types";
import type { GrowthIntelligenceEnrichedOutput } from "../ai/schemas/growth-intelligence";
import {
  buildRecommendationMemoryFromRecords,
  runWithGrowthIntelligenceContext,
} from "../ai/agents/agent-execution-context";
import { createPrismaGrowthIntelligenceFactsSource } from "./growth-intelligence-facts.server";
import { processGrowthIntelligenceLifecycle } from "./growth-intelligence-lifecycle.server";

export type ExecuteGrowthIntelligenceInput = {
  storeId: string;
  merchantId?: string;
  force?: boolean;
  merchantContext?: AIOrchestratorExecuteInput["merchantContext"];
  persistence?: AIPersistenceRepositories;
  orchestrator?: AIOrchestrator;
  orchestratorDeps?: Partial<AIOrchestratorDependencies>;
  factsSource?: GrowthIntelligenceFactsSource;
  skipLifecycle?: boolean;
};

export function buildGrowthIntelligenceSubjectKey(storeId: string): string {
  return `growth-intelligence:${storeId}`;
}

export async function executeGrowthIntelligence(
  input: ExecuteGrowthIntelligenceInput,
): Promise<AIOrchestratorExecuteResult<GrowthIntelligenceEnrichedOutput>> {
  const persistence = input.persistence ?? createPrismaAIPersistence();
  const subjectKey = buildGrowthIntelligenceSubjectKey(input.storeId);

  if (!input.skipLifecycle) {
    const factsBuilder = createGrowthIntelligenceFactsBuilder(
      input.factsSource ?? createPrismaGrowthIntelligenceFactsSource(),
    );
    const facts = await factsBuilder.build({
      storeId: input.storeId,
    });

    await processGrowthIntelligenceLifecycle({
      storeId: input.storeId,
      subjectKey,
      facts,
      persistence,
    });
  }

  const refreshedRecommendations = await persistence.recommendations.listBySubject({
    storeId: input.storeId,
    subjectKey,
  });

  const orchestrator =
    input.orchestrator ??
    getAIOrchestrator(
      input.persistence || input.orchestratorDeps
        ? {
            persistence,
            ...input.orchestratorDeps,
          }
        : undefined,
    );

  return runWithGrowthIntelligenceContext(
    {
      storeId: input.storeId,
      subjectKey,
      recommendationMemory: buildRecommendationMemoryFromRecords(refreshedRecommendations),
      recommendationRecords: refreshedRecommendations.map((record) => ({
        category: record.category,
        status: record.status,
        stableId: record.stableId,
        payloadJson: record.payloadJson,
      })),
    },
    () =>
      orchestrator.execute({
        agent: "growth_intelligence",
        storeId: input.storeId,
        merchantId: input.merchantId,
        force: input.force,
        merchantContext: input.merchantContext,
        context: {
          subjectKey,
        },
      }) as Promise<AIOrchestratorExecuteResult<GrowthIntelligenceEnrichedOutput>>,
  );
}

export { recordGrowthMerchantRecommendationFeedback } from "./growth-intelligence-lifecycle.server";
