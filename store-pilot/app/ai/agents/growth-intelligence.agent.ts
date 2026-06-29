import { genericPromptBuilder, type PromptBuildInput, type PromptBuilder } from "../builders/prompt-builder";
import {
  createGrowthIntelligenceFactsBuilder,
  type GrowthIntelligenceFacts,
  type GrowthIntelligenceFactsSource,
} from "../facts/growth-intelligence-facts";
import {
  growthIntelligenceSchema,
  type GrowthIntelligenceEnrichedOutput,
  type GrowthIntelligenceOutput,
} from "../schemas/growth-intelligence";
import { validateRecommendations } from "../validation/recommendation-validator";
import type { AgentDefinition } from "./agent-definition";
import { getGrowthIntelligenceExecutionContext } from "./agent-execution-context";
import { buildGrowthIntelligenceEvidenceCatalog } from "./growth-intelligence-evidence";
import {
  extractGrowthIntelligenceRecommendations,
  validateGrowthIntelligenceBusinessRules,
} from "./growth-intelligence.validator";
import { createPrismaGrowthIntelligenceFactsSource } from "../../services/growth-intelligence-facts.server";

class GrowthIntelligencePromptBuilder implements PromptBuilder<GrowthIntelligenceFacts> {
  async build(input: PromptBuildInput<GrowthIntelligenceFacts>) {
    const executionContext = getGrowthIntelligenceExecutionContext();
    const evidenceCatalog = buildGrowthIntelligenceEvidenceCatalog(input.facts);

    if (executionContext) {
      executionContext.evidenceCatalog = evidenceCatalog;
    }

    return genericPromptBuilder.build({
      ...input,
      memoryContext: {
        ...(input.memoryContext ?? {}),
        evidenceCatalog,
        growthScores: input.facts.scores,
        growthScore: input.facts.scores.growthScore,
        growthHealthScore: input.facts.growthHealthScore,
        revenueOpportunity: input.facts.scores.revenueOpportunity,
        aovOpportunity: input.facts.scores.profitOpportunity,
        strategySignals: input.facts.strategySignals,
        merchantGrowthPreferences: input.facts.merchantGrowthPreferences,
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

export function createGrowthIntelligenceAgentDefinition(
  source: GrowthIntelligenceFactsSource = createPrismaGrowthIntelligenceFactsSource(),
): AgentDefinition<GrowthIntelligenceFacts, typeof growthIntelligenceSchema> {
  return {
    id: "growth_intelligence",
    promptId: "growth-intelligence",
    schema: growthIntelligenceSchema,
    factBuilder: createGrowthIntelligenceFactsBuilder(source),
    promptBuilder: new GrowthIntelligencePromptBuilder(),
    validateBusinessRules: validateGrowthIntelligenceBusinessRules,
    extractRecommendations: ({ output }) => {
      const candidates = extractGrowthIntelligenceRecommendations(output);
      validateRecommendations(candidates);
      return candidates;
    },
    buildFactContext() {
      return {};
    },
  };
}

export const growthIntelligenceAgentDefinition = createGrowthIntelligenceAgentDefinition();

export type { GrowthIntelligenceOutput, GrowthIntelligenceEnrichedOutput };
