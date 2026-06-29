import {
  getAIOrchestrator,
  AIOrchestrator,
  type AIOrchestratorDependencies,
  type AIOrchestratorExecuteInput,
  type AIOrchestratorExecuteResult,
} from "../ai/orchestrator/ai-orchestrator.server";
import {
  createBundleFactsBuilder,
  type BundleFactsSource,
} from "../ai/facts/bundle-facts";
import { createPrismaAIPersistence } from "../ai/persistence/prisma-persistence";
import type { AIPersistenceRepositories } from "../ai/persistence/types";
import type { BundleIntelligenceEnrichedOutput } from "../ai/schemas/bundle-intelligence";
import {
  buildRecommendationMemoryFromRecords,
  runWithBundleDiscoveryContext,
} from "../ai/agents/agent-execution-context";
import { createPrismaBundleFactsSource } from "./bundle-intelligence-facts.server";
import { processBundleDiscoveryLifecycle } from "./bundle-intelligence-lifecycle.server";

export type ExecuteBundleDiscoveryInput = {
  storeId: string;
  merchantId?: string;
  force?: boolean;
  merchantContext?: AIOrchestratorExecuteInput["merchantContext"];
  persistence?: AIPersistenceRepositories;
  orchestrator?: AIOrchestrator;
  orchestratorDeps?: Partial<AIOrchestratorDependencies>;
  factsSource?: BundleFactsSource;
  skipLifecycle?: boolean;
};

export function buildBundleDiscoverySubjectKey(storeId: string): string {
  return `bundle:${storeId}`;
}

export async function executeBundleDiscovery(
  input: ExecuteBundleDiscoveryInput,
): Promise<AIOrchestratorExecuteResult<BundleIntelligenceEnrichedOutput>> {
  const persistence = input.persistence ?? createPrismaAIPersistence();
  const subjectKey = buildBundleDiscoverySubjectKey(input.storeId);

  if (!input.skipLifecycle) {
    const factsBuilder = createBundleFactsBuilder(
      input.factsSource ?? createPrismaBundleFactsSource(),
    );
    const facts = await factsBuilder.build({
      storeId: input.storeId,
    });

    await processBundleDiscoveryLifecycle({
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

  return runWithBundleDiscoveryContext(
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
        agent: "bundle_discovery",
        storeId: input.storeId,
        merchantId: input.merchantId,
        force: input.force,
        merchantContext: input.merchantContext,
        context: {
          subjectKey,
        },
      }) as Promise<AIOrchestratorExecuteResult<BundleIntelligenceEnrichedOutput>>,
  );
}

export { recordBundleMerchantRecommendationFeedback } from "./bundle-intelligence-lifecycle.server";
