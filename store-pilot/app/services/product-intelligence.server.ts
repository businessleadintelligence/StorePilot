import {
  getAIOrchestrator,
  AIOrchestrator,
  type AIOrchestratorDependencies,
  type AIOrchestratorExecuteInput,
  type AIOrchestratorExecuteResult,
} from "../ai/orchestrator/ai-orchestrator.server";
import { createProductFactsBuilder, type ProductFactsSource } from "../ai/facts/product-facts";
import { createPrismaAIPersistence } from "../ai/persistence/prisma-persistence";
import type { AIPersistenceRepositories } from "../ai/persistence/types";
import type { ProductIntelligenceEnrichedOutput } from "../ai/schemas/product-intelligence";
import {
  buildRecommendationMemoryFromRecords,
  runWithProductIntelligenceContext,
} from "../ai/agents/agent-execution-context";
import { createPrismaProductFactsSource } from "./product-intelligence-facts.server";
import { processProductIntelligenceLifecycle } from "./product-intelligence-lifecycle.server";

export type ExecuteProductIntelligenceInput = {
  storeId: string;
  productId: string;
  merchantId?: string;
  force?: boolean;
  merchantContext?: AIOrchestratorExecuteInput["merchantContext"];
  persistence?: AIPersistenceRepositories;
  orchestrator?: AIOrchestrator;
  orchestratorDeps?: Partial<AIOrchestratorDependencies>;
  factsSource?: ProductFactsSource;
  skipLifecycle?: boolean;
};

export function buildProductIntelligenceSubjectKey(productId: string): string {
  return `product:${productId}`;
}

export async function executeProductIntelligence(
  input: ExecuteProductIntelligenceInput,
): Promise<AIOrchestratorExecuteResult<ProductIntelligenceEnrichedOutput>> {
  const persistence = input.persistence ?? createPrismaAIPersistence();
  const subjectKey = buildProductIntelligenceSubjectKey(input.productId);

  if (!input.skipLifecycle) {
    const factsBuilder = createProductFactsBuilder(
      input.factsSource ?? createPrismaProductFactsSource(),
    );
    const facts = await factsBuilder.build({
      storeId: input.storeId,
      productId: input.productId,
    });

    await processProductIntelligenceLifecycle({
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

  return runWithProductIntelligenceContext(
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
        agent: "product_intelligence",
        storeId: input.storeId,
        merchantId: input.merchantId,
        force: input.force,
        merchantContext: input.merchantContext,
        context: {
          subjectKey,
          productId: input.productId,
        },
      }) as Promise<AIOrchestratorExecuteResult<ProductIntelligenceEnrichedOutput>>,
  );
}

export { recordMerchantRecommendationFeedback } from "./product-intelligence-lifecycle.server";
