import {
  getAIOrchestrator,
  AIOrchestrator,
  type AIOrchestratorDependencies,
  type AIOrchestratorExecuteInput,
  type AIOrchestratorExecuteResult,
} from "../ai/orchestrator/ai-orchestrator.server";
import { createTrendFactsBuilder, type TrendFactsSource } from "../ai/facts/trend-facts";
import { createPrismaAIPersistence } from "../ai/persistence/prisma-persistence";
import type { AIPersistenceRepositories } from "../ai/persistence/types";
import type { TrendIntelligenceEnrichedOutput } from "../ai/schemas/trend-intelligence";
import {
  buildRecommendationMemoryFromRecords,
  runWithTrendIntelligenceContext,
} from "../ai/agents/agent-execution-context";
import { createPrismaTrendFactsSource } from "./trend-intelligence-facts.server";
import { processTrendIntelligenceLifecycle } from "./trend-intelligence-lifecycle.server";

export type ExecuteTrendIntelligenceInput = {
  storeId: string;
  merchantId?: string;
  force?: boolean;
  merchantContext?: AIOrchestratorExecuteInput["merchantContext"];
  persistence?: AIPersistenceRepositories;
  orchestrator?: AIOrchestrator;
  orchestratorDeps?: Partial<AIOrchestratorDependencies>;
  factsSource?: TrendFactsSource;
  skipLifecycle?: boolean;
};

export function buildTrendIntelligenceSubjectKey(storeId: string): string {
  return `trend:${storeId}`;
}

export async function executeTrendIntelligence(
  input: ExecuteTrendIntelligenceInput,
): Promise<AIOrchestratorExecuteResult<TrendIntelligenceEnrichedOutput>> {
  const persistence = input.persistence ?? createPrismaAIPersistence();
  const subjectKey = buildTrendIntelligenceSubjectKey(input.storeId);

  if (!input.skipLifecycle) {
    const factsBuilder = createTrendFactsBuilder(
      input.factsSource ?? createPrismaTrendFactsSource(),
    );
    const facts = await factsBuilder.build({ storeId: input.storeId });
    await processTrendIntelligenceLifecycle({
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
        ? { persistence, ...input.orchestratorDeps }
        : undefined,
    );

  return runWithTrendIntelligenceContext(
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
        agent: "trend_intelligence",
        storeId: input.storeId,
        merchantId: input.merchantId,
        force: input.force,
        merchantContext: input.merchantContext,
        context: { subjectKey },
      }) as Promise<AIOrchestratorExecuteResult<TrendIntelligenceEnrichedOutput>>,
  );
}

export { recordTrendMerchantRecommendationFeedback } from "./trend-intelligence-lifecycle.server";
