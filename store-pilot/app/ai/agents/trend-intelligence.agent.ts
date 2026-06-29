import { genericPromptBuilder, type PromptBuildInput, type PromptBuilder } from "../builders/prompt-builder";
import {
  createTrendFactsBuilder,
  type TrendFacts,
  type TrendFactsSource,
} from "../facts/trend-facts";
import {
  trendIntelligenceSchema,
  type TrendIntelligenceEnrichedOutput,
  type TrendIntelligenceOutput,
} from "../schemas/trend-intelligence";
import { validateRecommendations } from "../validation/recommendation-validator";
import type { AgentDefinition } from "./agent-definition";
import { getTrendIntelligenceExecutionContext } from "./agent-execution-context";
import { buildTrendEvidenceCatalog } from "./trend-intelligence-evidence";
import {
  extractTrendIntelligenceRecommendations,
  validateTrendIntelligenceBusinessRules,
} from "./trend-intelligence.validator";
import { createPrismaTrendFactsSource } from "../../services/trend-intelligence-facts.server";

class TrendIntelligencePromptBuilder implements PromptBuilder<TrendFacts> {
  async build(input: PromptBuildInput<TrendFacts>) {
    const executionContext = getTrendIntelligenceExecutionContext();
    const evidenceCatalog = buildTrendEvidenceCatalog(input.facts);
    if (executionContext) executionContext.evidenceCatalog = evidenceCatalog;

    return genericPromptBuilder.build({
      ...input,
      memoryContext: {
        ...(input.memoryContext ?? {}),
        evidenceCatalog,
        trendDirection: input.facts.trendDirection,
        trendHealthScore: input.facts.trendHealthScore,
        emergingProducts: input.facts.products.filter((product) => product.direction === "emerging").slice(0, 8),
        decliningProducts: input.facts.products.filter((product) => product.direction === "declining").slice(0, 8),
        categoryTrends: input.facts.categoryTrend.slice(0, 8),
        seasonalSignals: input.facts.seasonalSignals,
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

export function createTrendIntelligenceAgentDefinition(
  source: TrendFactsSource = createPrismaTrendFactsSource(),
): AgentDefinition<TrendFacts, typeof trendIntelligenceSchema> {
  return {
    id: "trend_intelligence",
    promptId: "trend-intelligence",
    schema: trendIntelligenceSchema,
    factBuilder: createTrendFactsBuilder(source),
    promptBuilder: new TrendIntelligencePromptBuilder(),
    validateBusinessRules: validateTrendIntelligenceBusinessRules,
    extractRecommendations: ({ output }) => {
      const candidates = extractTrendIntelligenceRecommendations(output);
      validateRecommendations(candidates);
      return candidates;
    },
    buildFactContext() {
      return {};
    },
  };
}

export const trendIntelligenceAgentDefinition = createTrendIntelligenceAgentDefinition();

export type { TrendIntelligenceOutput, TrendIntelligenceEnrichedOutput };
