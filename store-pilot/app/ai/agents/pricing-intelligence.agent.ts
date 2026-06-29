import { genericPromptBuilder, type PromptBuildInput, type PromptBuilder } from "../builders/prompt-builder";
import {
  createPricingIntelligenceFactsBuilder,
  type PricingIntelligenceFacts,
  type PricingIntelligenceFactsSource,
} from "../facts/pricing-intelligence-facts";
import {
  pricingIntelligenceSchema,
  type PricingIntelligenceEnrichedOutput,
  type PricingIntelligenceOutput,
} from "../schemas/pricing-intelligence";
import { validateRecommendations } from "../validation/recommendation-validator";
import type { AgentDefinition } from "./agent-definition";
import { getPricingIntelligenceExecutionContext } from "./agent-execution-context";
import { buildPricingIntelligenceEvidenceCatalog } from "./pricing-intelligence-evidence";
import {
  extractPricingIntelligenceRecommendations,
  validatePricingIntelligenceBusinessRules,
} from "./pricing-intelligence.validator";
import { createPrismaPricingIntelligenceFactsSource } from "../../services/pricing-intelligence-facts.server";

class PricingIntelligencePromptBuilder implements PromptBuilder<PricingIntelligenceFacts> {
  async build(input: PromptBuildInput<PricingIntelligenceFacts>) {
    const executionContext = getPricingIntelligenceExecutionContext();
    const evidenceCatalog = buildPricingIntelligenceEvidenceCatalog(input.facts);

    if (executionContext) {
      executionContext.evidenceCatalog = evidenceCatalog;
    }

    return genericPromptBuilder.build({
      ...input,
      memoryContext: {
        ...(input.memoryContext ?? {}),
        evidenceCatalog,
        pricingScores: input.facts.scores,
        pricingHealthScore: input.facts.pricingHealthScore,
        revenueOpportunity: input.facts.revenueOpportunity,
        profitOpportunity: input.facts.profitOpportunity,
        strategySignals: input.facts.strategySignals,
        merchantPricingPreferences: input.facts.merchantPricingPreferences,
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

export function createPricingIntelligenceAgentDefinition(
  source: PricingIntelligenceFactsSource = createPrismaPricingIntelligenceFactsSource(),
): AgentDefinition<PricingIntelligenceFacts, typeof pricingIntelligenceSchema> {
  return {
    id: "pricing_intelligence",
    promptId: "pricing-intelligence",
    schema: pricingIntelligenceSchema,
    factBuilder: createPricingIntelligenceFactsBuilder(source),
    promptBuilder: new PricingIntelligencePromptBuilder(),
    validateBusinessRules: validatePricingIntelligenceBusinessRules,
    extractRecommendations: ({ output }) => {
      const candidates = extractPricingIntelligenceRecommendations(output);
      validateRecommendations(candidates);
      return candidates;
    },
    buildFactContext() {
      return {};
    },
  };
}

export const pricingIntelligenceAgentDefinition = createPricingIntelligenceAgentDefinition();

export type { PricingIntelligenceOutput, PricingIntelligenceEnrichedOutput };
