import { genericPromptBuilder, type PromptBuildInput, type PromptBuilder } from "../builders/prompt-builder";
import { createProductFactsBuilder, type ProductFacts, type ProductFactsSource } from "../facts/product-facts";
import {
  productIntelligenceSchema,
  type ProductIntelligenceEnrichedOutput,
  type ProductIntelligenceOutput,
} from "../schemas/product-intelligence";
import { validateRecommendations } from "../validation/recommendation-validator";
import type { AgentDefinition } from "./agent-definition";
import { getProductIntelligenceExecutionContext } from "./agent-execution-context";
import { buildEvidenceCatalog } from "./product-intelligence-evidence";
import {
  extractProductIntelligenceRecommendations,
  validateProductIntelligenceBusinessRules,
} from "./product-intelligence.validator";
import { createPrismaProductFactsSource } from "../../services/product-intelligence-facts.server";

class ProductIntelligencePromptBuilder implements PromptBuilder<ProductFacts> {
  async build(input: PromptBuildInput<ProductFacts>) {
    const executionContext = getProductIntelligenceExecutionContext();
    const evidenceCatalog = buildEvidenceCatalog(input.facts);

    if (executionContext) {
      executionContext.evidenceCatalog = evidenceCatalog;
    }

    return genericPromptBuilder.build({
      ...input,
      memoryContext: {
        ...(input.memoryContext ?? {}),
        evidenceCatalog,
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

export function createProductIntelligenceAgentDefinition(
  source: ProductFactsSource = createPrismaProductFactsSource(),
): AgentDefinition<ProductFacts, typeof productIntelligenceSchema> {
  return {
    id: "product_intelligence",
    promptId: "product-intelligence",
    schema: productIntelligenceSchema,
    factBuilder: createProductFactsBuilder(source),
    promptBuilder: new ProductIntelligencePromptBuilder(),
    validateBusinessRules: validateProductIntelligenceBusinessRules,
    extractRecommendations: ({ output }) => {
      const candidates = extractProductIntelligenceRecommendations(output);
      validateRecommendations(candidates);
      return candidates;
    },
    buildFactContext(context) {
      return {
        productId: String(context.productId),
      };
    },
  };
}

export const productIntelligenceAgentDefinition =
  createProductIntelligenceAgentDefinition();

export type { ProductIntelligenceOutput, ProductIntelligenceEnrichedOutput };
