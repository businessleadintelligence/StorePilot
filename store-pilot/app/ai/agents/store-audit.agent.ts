import { genericPromptBuilder, type PromptBuildInput, type PromptBuilder } from "../builders/prompt-builder";
import {
  createStoreAuditFactsBuilder,
  type StoreAuditFacts,
  type StoreAuditFactsSource,
} from "../facts/store-audit-facts";
import {
  storeAuditIntelligenceSchema,
  type StoreAuditIntelligenceEnrichedOutput,
  type StoreAuditIntelligenceOutput,
} from "../schemas/store-audit-intelligence";
import { validateRecommendations } from "../validation/recommendation-validator";
import type { AgentDefinition } from "./agent-definition";
import { getStoreAuditExecutionContext } from "./agent-execution-context";
import { buildStoreAuditEvidenceCatalog } from "./store-audit-evidence";
import {
  extractStoreAuditRecommendations,
  validateStoreAuditBusinessRules,
} from "./store-audit.validator";
import { createPrismaStoreAuditFactsSource } from "../../services/store-audit-facts.server";

class StoreAuditPromptBuilder implements PromptBuilder<StoreAuditFacts> {
  async build(input: PromptBuildInput<StoreAuditFacts>) {
    const executionContext = getStoreAuditExecutionContext();
    const evidenceCatalog = buildStoreAuditEvidenceCatalog(input.facts);

    if (executionContext) {
      executionContext.evidenceCatalog = evidenceCatalog;
    }

    return genericPromptBuilder.build({
      ...input,
      memoryContext: {
        ...(input.memoryContext ?? {}),
        evidenceCatalog,
        auditScores: {
          storeHealthScore: input.facts.storeHealthScore,
          overallAuditScore: input.facts.overallAuditScore,
          homepageScore: input.facts.homepageScore,
          performanceScore: input.facts.performanceScore,
          navigationScore: input.facts.navigationScore,
          seoScore: input.facts.seoScore,
          technicalSeoScore: input.facts.technicalSeoScore,
          accessibilityScore: input.facts.accessibilityScore,
          conversionScore: input.facts.conversionScore,
          mobileScore: input.facts.mobileScore,
          themeScore: input.facts.themeScore,
          imageOptimizationScore: input.facts.imageOptimizationScore,
          trustScore: input.facts.trustScore,
          policyScore: input.facts.policyScore,
          appBloatScore: input.facts.appBloatScore,
          merchantBestPracticesScore: input.facts.merchantBestPracticesScore,
        },
        implementedRecommendationIds: input.facts.implementedRecommendationIds,
        recommendationHistory: executionContext
          ? {
              implemented: [...executionContext.recommendationMemory.implementedIds],
              dismissed: [...executionContext.recommendationMemory.dismissedIds],
              open: [...executionContext.recommendationMemory.openIds],
              snoozed: [...executionContext.recommendationMemory.snoozedIds],
              ignored: [...executionContext.recommendationMemory.ignoredIds],
            }
          : null,
      },
    });
  }
}

export function createStoreAuditAgentDefinition(
  source: StoreAuditFactsSource = createPrismaStoreAuditFactsSource(),
): AgentDefinition<StoreAuditFacts, typeof storeAuditIntelligenceSchema> {
  return {
    id: "store_audit",
    promptId: "store-audit",
    schema: storeAuditIntelligenceSchema,
    factBuilder: createStoreAuditFactsBuilder(source),
    promptBuilder: new StoreAuditPromptBuilder(),
    validateBusinessRules: validateStoreAuditBusinessRules,
    extractRecommendations: ({ output }) => {
      const candidates = extractStoreAuditRecommendations(output);
      validateRecommendations(candidates);
      return candidates;
    },
    buildFactContext() {
      return {};
    },
  };
}

export const storeAuditAgentDefinition = createStoreAuditAgentDefinition();

export type { StoreAuditIntelligenceOutput, StoreAuditIntelligenceEnrichedOutput };
