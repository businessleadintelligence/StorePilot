import {
  getAIOrchestrator,
  AIOrchestrator,
  type AIOrchestratorDependencies,
  type AIOrchestratorExecuteInput,
  type AIOrchestratorExecuteResult,
} from "../ai/orchestrator/ai-orchestrator.server";
import {
  createInventoryFactsBuilder,
  type InventoryFactsSource,
} from "../ai/facts/inventory-facts";
import { createPrismaAIPersistence } from "../ai/persistence/prisma-persistence";
import type { AIPersistenceRepositories } from "../ai/persistence/types";
import type { InventoryIntelligenceEnrichedOutput } from "../ai/schemas/inventory-intelligence";
import {
  buildRecommendationMemoryFromRecords,
  runWithInventoryIntelligenceContext,
} from "../ai/agents/agent-execution-context";
import { createPrismaInventoryFactsSource } from "./inventory-intelligence-facts.server";
import { processInventoryIntelligenceLifecycle } from "./inventory-intelligence-lifecycle.server";

export type ExecuteInventoryIntelligenceInput = {
  storeId: string;
  merchantId?: string;
  force?: boolean;
  merchantContext?: AIOrchestratorExecuteInput["merchantContext"];
  persistence?: AIPersistenceRepositories;
  orchestrator?: AIOrchestrator;
  orchestratorDeps?: Partial<AIOrchestratorDependencies>;
  factsSource?: InventoryFactsSource;
  skipLifecycle?: boolean;
};

export function buildInventoryIntelligenceSubjectKey(storeId: string): string {
  return `inventory:${storeId}`;
}

export async function executeInventoryIntelligence(
  input: ExecuteInventoryIntelligenceInput,
): Promise<AIOrchestratorExecuteResult<InventoryIntelligenceEnrichedOutput>> {
  const persistence = input.persistence ?? createPrismaAIPersistence();
  const subjectKey = buildInventoryIntelligenceSubjectKey(input.storeId);

  if (!input.skipLifecycle) {
    const factsBuilder = createInventoryFactsBuilder(
      input.factsSource ?? createPrismaInventoryFactsSource(),
    );
    const facts = await factsBuilder.build({
      storeId: input.storeId,
    });

    await processInventoryIntelligenceLifecycle({
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

  return runWithInventoryIntelligenceContext(
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
        agent: "inventory_intelligence",
        storeId: input.storeId,
        merchantId: input.merchantId,
        force: input.force,
        merchantContext: input.merchantContext,
        context: {
          subjectKey,
        },
      }) as Promise<AIOrchestratorExecuteResult<InventoryIntelligenceEnrichedOutput>>,
  );
}

export { recordInventoryMerchantRecommendationFeedback } from "./inventory-intelligence-lifecycle.server";
