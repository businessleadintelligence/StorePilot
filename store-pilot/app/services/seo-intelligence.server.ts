import {
  getAIOrchestrator,
  AIOrchestrator,
  type AIOrchestratorDependencies,
  type AIOrchestratorExecuteInput,
  type AIOrchestratorExecuteResult,
} from "../ai/orchestrator/ai-orchestrator.server";
import {
  createSeoIntelligenceFactsBuilder,
  type SeoIntelligenceFactsSource,
} from "../ai/facts/seo-intelligence-facts";
import { createPrismaAIPersistence } from "../ai/persistence/prisma-persistence";
import type { AIPersistenceRepositories } from "../ai/persistence/types";
import type { SeoIntelligenceEnrichedOutput } from "../ai/schemas/seo-intelligence";
import {
  buildRecommendationMemoryFromRecords,
  runWithSeoIntelligenceContext,
} from "../ai/agents/agent-execution-context";
import { createPrismaSeoIntelligenceFactsSource } from "./seo-intelligence-facts.server";
import { processSeoIntelligenceLifecycle } from "./seo-intelligence-lifecycle.server";

export type ExecuteSeoIntelligenceInput = {
  storeId: string;
  merchantId?: string;
  force?: boolean;
  merchantContext?: AIOrchestratorExecuteInput["merchantContext"];
  persistence?: AIPersistenceRepositories;
  orchestrator?: AIOrchestrator;
  orchestratorDeps?: Partial<AIOrchestratorDependencies>;
  factsSource?: SeoIntelligenceFactsSource;
  skipLifecycle?: boolean;
};

export function buildSeoIntelligenceSubjectKey(storeId: string): string {
  return `seo-intelligence:${storeId}`;
}

export async function executeSeoIntelligence(
  input: ExecuteSeoIntelligenceInput,
): Promise<AIOrchestratorExecuteResult<SeoIntelligenceEnrichedOutput>> {
  const persistence = input.persistence ?? createPrismaAIPersistence();
  const subjectKey = buildSeoIntelligenceSubjectKey(input.storeId);

  if (!input.skipLifecycle) {
    const factsBuilder = createSeoIntelligenceFactsBuilder(
      input.factsSource ?? createPrismaSeoIntelligenceFactsSource(),
    );
    const facts = await factsBuilder.build({
      storeId: input.storeId,
    });

    await processSeoIntelligenceLifecycle({
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

  return runWithSeoIntelligenceContext(
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
        agent: "seo_audit",
        storeId: input.storeId,
        merchantId: input.merchantId,
        force: input.force,
        merchantContext: input.merchantContext,
        context: {
          subjectKey,
        },
      }) as Promise<AIOrchestratorExecuteResult<SeoIntelligenceEnrichedOutput>>,
  );
}

export { recordSeoMerchantRecommendationFeedback } from "./seo-intelligence-lifecycle.server";
