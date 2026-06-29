import { genericPromptBuilder, type PromptBuildInput, type PromptBuilder } from "../builders/prompt-builder";
import {
  createInventoryFactsBuilder,
  type InventoryFacts,
  type InventoryFactsSource,
} from "../facts/inventory-facts";
import {
  inventoryIntelligenceSchema,
  type InventoryIntelligenceEnrichedOutput,
  type InventoryIntelligenceOutput,
} from "../schemas/inventory-intelligence";
import { validateRecommendations } from "../validation/recommendation-validator";
import type { AgentDefinition } from "./agent-definition";
import { getInventoryIntelligenceExecutionContext } from "./agent-execution-context";
import { buildInventoryEvidenceCatalog } from "./inventory-intelligence-evidence";
import {
  extractInventoryIntelligenceRecommendations,
  validateInventoryIntelligenceBusinessRules,
} from "./inventory-intelligence.validator";
import { createPrismaInventoryFactsSource } from "../../services/inventory-intelligence-facts.server";

class InventoryIntelligencePromptBuilder implements PromptBuilder<InventoryFacts> {
  async build(input: PromptBuildInput<InventoryFacts>) {
    const executionContext = getInventoryIntelligenceExecutionContext();
    const evidenceCatalog = buildInventoryEvidenceCatalog(input.facts);

    if (executionContext) {
      executionContext.evidenceCatalog = evidenceCatalog;
    }

    return genericPromptBuilder.build({
      ...input,
      memoryContext: {
        ...(input.memoryContext ?? {}),
        evidenceCatalog,
        stockAlerts: input.facts.stockAlerts,
        reorderSuggestions: input.facts.reorderSuggestions,
        overstockProducts: input.facts.overstockProducts,
        understockProducts: input.facts.understockProducts,
        deadInventory: input.facts.deadInventory,
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

export function createInventoryIntelligenceAgentDefinition(
  source: InventoryFactsSource = createPrismaInventoryFactsSource(),
): AgentDefinition<InventoryFacts, typeof inventoryIntelligenceSchema> {
  return {
    id: "inventory_intelligence",
    promptId: "inventory-intelligence",
    schema: inventoryIntelligenceSchema,
    factBuilder: createInventoryFactsBuilder(source),
    promptBuilder: new InventoryIntelligencePromptBuilder(),
    validateBusinessRules: validateInventoryIntelligenceBusinessRules,
    extractRecommendations: ({ output }) => {
      const candidates = extractInventoryIntelligenceRecommendations(output);
      validateRecommendations(candidates);
      return candidates;
    },
    buildFactContext() {
      return {};
    },
  };
}

export const inventoryIntelligenceAgentDefinition =
  createInventoryIntelligenceAgentDefinition();

export type { InventoryIntelligenceOutput, InventoryIntelligenceEnrichedOutput };
