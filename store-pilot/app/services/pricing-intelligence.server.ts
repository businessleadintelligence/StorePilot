import {
  getAIOrchestrator,
  AIOrchestrator,
  type AIOrchestratorDependencies,
  type AIOrchestratorExecuteInput,
  type AIOrchestratorExecuteResult,
} from "../ai/orchestrator/ai-orchestrator.server";
import {
  createPricingIntelligenceFactsBuilder,
  type PricingIntelligenceFactsSource,
} from "../ai/facts/pricing-intelligence-facts";
import { createPrismaAIPersistence } from "../ai/persistence/prisma-persistence";
import type { AIPersistenceRepositories } from "../ai/persistence/types";
import type { PricingIntelligenceEnrichedOutput } from "../ai/schemas/pricing-intelligence";
import {
  buildRecommendationMemoryFromRecords,
  runWithPricingIntelligenceContext,
} from "../ai/agents/agent-execution-context";
import { createPrismaPricingIntelligenceFactsSource } from "./pricing-intelligence-facts.server";
import { processPricingIntelligenceLifecycle } from "./pricing-intelligence-lifecycle.server";

export type ExecutePricingIntelligenceInput = {
  storeId: string;
  merchantId?: string;
  force?: boolean;
  merchantContext?: AIOrchestratorExecuteInput["merchantContext"];
  persistence?: AIPersistenceRepositories;
  orchestrator?: AIOrchestrator;
  orchestratorDeps?: Partial<AIOrchestratorDependencies>;
  factsSource?: PricingIntelligenceFactsSource;
  skipLifecycle?: boolean;
};

export function buildPricingIntelligenceSubjectKey(storeId: string): string {
  return `pricing-intelligence:${storeId}`;
}

export async function executePricingIntelligence(
  input: ExecutePricingIntelligenceInput,
): Promise<AIOrchestratorExecuteResult<PricingIntelligenceEnrichedOutput>> {
  const persistence = input.persistence ?? createPrismaAIPersistence();
  const subjectKey = buildPricingIntelligenceSubjectKey(input.storeId);

  if (!input.skipLifecycle) {
    const factsBuilder = createPricingIntelligenceFactsBuilder(
      input.factsSource ?? createPrismaPricingIntelligenceFactsSource(),
    );
    const facts = await factsBuilder.build({
      storeId: input.storeId,
    });

    await processPricingIntelligenceLifecycle({
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

  return runWithPricingIntelligenceContext(
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
        agent: "pricing_intelligence",
        storeId: input.storeId,
        merchantId: input.merchantId,
        force: input.force,
        merchantContext: input.merchantContext,
        context: {
          subjectKey,
        },
      }) as Promise<AIOrchestratorExecuteResult<PricingIntelligenceEnrichedOutput>>,
  );
}

export { recordPricingMerchantRecommendationFeedback } from "./pricing-intelligence-lifecycle.server";
