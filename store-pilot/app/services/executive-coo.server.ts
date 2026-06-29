import {
  getAIOrchestrator,
  AIOrchestrator,
  type AIOrchestratorDependencies,
  type AIOrchestratorExecuteInput,
  type AIOrchestratorExecuteResult,
} from "../ai/orchestrator/ai-orchestrator.server";
import {
  createExecutiveCooFactsBuilder,
  type ExecutiveCooFactsSource,
} from "../ai/facts/executive-coo-facts";
import { createPrismaAIPersistence } from "../ai/persistence/prisma-persistence";
import type { AIPersistenceRepositories } from "../ai/persistence/types";
import type { ExecutiveCooEnrichedOutput } from "../ai/schemas/executive-coo";
import {
  buildRecommendationMemoryFromRecords,
  runWithExecutiveCooContext,
} from "../ai/agents/agent-execution-context";
import { createPrismaExecutiveCooFactsSource } from "./executive-coo-facts.server";
import { processExecutiveCooLifecycle } from "./executive-coo-lifecycle.server";

export type ExecuteExecutiveCooInput = {
  storeId: string;
  merchantId?: string;
  force?: boolean;
  merchantContext?: AIOrchestratorExecuteInput["merchantContext"];
  persistence?: AIPersistenceRepositories;
  orchestrator?: AIOrchestrator;
  orchestratorDeps?: Partial<AIOrchestratorDependencies>;
  factsSource?: ExecutiveCooFactsSource;
  skipLifecycle?: boolean;
};

export function buildExecutiveCooSubjectKey(storeId: string): string {
  return `executive-coo:${storeId}`;
}

export async function executeExecutiveCoo(
  input: ExecuteExecutiveCooInput,
): Promise<AIOrchestratorExecuteResult<ExecutiveCooEnrichedOutput>> {
  const persistence = input.persistence ?? createPrismaAIPersistence();
  const subjectKey = buildExecutiveCooSubjectKey(input.storeId);

  if (!input.skipLifecycle) {
    const factsBuilder = createExecutiveCooFactsBuilder(
      input.factsSource ?? createPrismaExecutiveCooFactsSource(),
    );
    const facts = await factsBuilder.build({
      storeId: input.storeId,
    });

    await processExecutiveCooLifecycle({
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

  return runWithExecutiveCooContext(
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
        agent: "executive_coo",
        storeId: input.storeId,
        merchantId: input.merchantId,
        force: input.force,
        merchantContext: input.merchantContext,
        context: {
          subjectKey,
        },
      }) as Promise<AIOrchestratorExecuteResult<ExecutiveCooEnrichedOutput>>,
  );
}

export { recordExecutiveCooMerchantPriorityFeedback } from "./executive-coo-lifecycle.server";
