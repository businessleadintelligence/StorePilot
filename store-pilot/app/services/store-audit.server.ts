import {
  getAIOrchestrator,
  AIOrchestrator,
  type AIOrchestratorDependencies,
  type AIOrchestratorExecuteInput,
  type AIOrchestratorExecuteResult,
} from "../ai/orchestrator/ai-orchestrator.server";
import {
  createStoreAuditFactsBuilder,
  type StoreAuditFactsSource,
} from "../ai/facts/store-audit-facts";
import { createPrismaAIPersistence } from "../ai/persistence/prisma-persistence";
import type { AIPersistenceRepositories } from "../ai/persistence/types";
import type { StoreAuditIntelligenceEnrichedOutput } from "../ai/schemas/store-audit-intelligence";
import {
  buildRecommendationMemoryFromRecords,
  runWithStoreAuditContext,
} from "../ai/agents/agent-execution-context";
import { createPrismaStoreAuditFactsSource } from "./store-audit-facts.server";
import { processStoreAuditLifecycle } from "./store-audit-lifecycle.server";

export type ExecuteStoreAuditInput = {
  storeId: string;
  merchantId?: string;
  force?: boolean;
  merchantContext?: AIOrchestratorExecuteInput["merchantContext"];
  persistence?: AIPersistenceRepositories;
  orchestrator?: AIOrchestrator;
  orchestratorDeps?: Partial<AIOrchestratorDependencies>;
  factsSource?: StoreAuditFactsSource;
  skipLifecycle?: boolean;
};

export function buildStoreAuditSubjectKey(storeId: string): string {
  return `store-audit:${storeId}`;
}

export async function executeStoreAudit(
  input: ExecuteStoreAuditInput,
): Promise<AIOrchestratorExecuteResult<StoreAuditIntelligenceEnrichedOutput>> {
  const persistence = input.persistence ?? createPrismaAIPersistence();
  const subjectKey = buildStoreAuditSubjectKey(input.storeId);

  if (!input.skipLifecycle) {
    const factsBuilder = createStoreAuditFactsBuilder(
      input.factsSource ?? createPrismaStoreAuditFactsSource(),
    );
    const facts = await factsBuilder.build({
      storeId: input.storeId,
    });

    await processStoreAuditLifecycle({
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

  return runWithStoreAuditContext(
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
        agent: "store_audit",
        storeId: input.storeId,
        merchantId: input.merchantId,
        force: input.force,
        merchantContext: input.merchantContext,
        context: {
          subjectKey,
        },
      }) as Promise<AIOrchestratorExecuteResult<StoreAuditIntelligenceEnrichedOutput>>,
  );
}

export { recordStoreAuditMerchantRecommendationFeedback } from "./store-audit-lifecycle.server";
