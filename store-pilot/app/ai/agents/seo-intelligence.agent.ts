import { genericPromptBuilder, type PromptBuildInput, type PromptBuilder } from "../builders/prompt-builder";
import {
  createSeoIntelligenceFactsBuilder,
  type SeoIntelligenceFacts,
  type SeoIntelligenceFactsSource,
} from "../facts/seo-intelligence-facts";
import {
  seoIntelligenceSchema,
  type SeoIntelligenceEnrichedOutput,
  type SeoIntelligenceOutput,
} from "../schemas/seo-intelligence";
import { validateRecommendations } from "../validation/recommendation-validator";
import type { AgentDefinition } from "./agent-definition";
import { getSeoIntelligenceExecutionContext } from "./agent-execution-context";
import { buildSeoIntelligenceEvidenceCatalog } from "./seo-intelligence-evidence";
import {
  extractSeoIntelligenceRecommendations,
  validateSeoIntelligenceBusinessRules,
} from "./seo-intelligence.validator";
import { createPrismaSeoIntelligenceFactsSource } from "../../services/seo-intelligence-facts.server";

class SeoIntelligencePromptBuilder implements PromptBuilder<SeoIntelligenceFacts> {
  async build(input: PromptBuildInput<SeoIntelligenceFacts>) {
    const executionContext = getSeoIntelligenceExecutionContext();
    const evidenceCatalog = buildSeoIntelligenceEvidenceCatalog(input.facts);

    if (executionContext) {
      executionContext.evidenceCatalog = evidenceCatalog;
    }

    return genericPromptBuilder.build({
      ...input,
      memoryContext: {
        ...(input.memoryContext ?? {}),
        evidenceCatalog,
        seoScores: input.facts.scores,
        seoHealthScore: input.facts.seoHealthScore,
        trafficOpportunity: input.facts.trafficOpportunity,
        visibilityOpportunity: input.facts.visibilityOpportunity,
        knowledgeRules: input.facts.knowledgeRules,
        ruleSetVersion: input.facts.ruleSetVersion,
        connectors: input.facts.connectors,
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

export function createSeoIntelligenceAgentDefinition(
  source: SeoIntelligenceFactsSource = createPrismaSeoIntelligenceFactsSource(),
): AgentDefinition<SeoIntelligenceFacts, typeof seoIntelligenceSchema> {
  return {
    id: "seo_audit",
    promptId: "seo-intelligence",
    schema: seoIntelligenceSchema,
    factBuilder: createSeoIntelligenceFactsBuilder(source),
    promptBuilder: new SeoIntelligencePromptBuilder(),
    validateBusinessRules: validateSeoIntelligenceBusinessRules,
    extractRecommendations: ({ output }) => {
      const candidates = extractSeoIntelligenceRecommendations(output);
      validateRecommendations(candidates);
      return candidates;
    },
    buildFactContext() {
      return {};
    },
  };
}

export const seoIntelligenceAgentDefinition = createSeoIntelligenceAgentDefinition();

export type { SeoIntelligenceOutput, SeoIntelligenceEnrichedOutput };
