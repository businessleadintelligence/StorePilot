import { genericPromptBuilder, type PromptBuildInput, type PromptBuilder } from "../builders/prompt-builder";
import {
  createExecutiveCooFactsBuilder,
  type ExecutiveCooFacts,
  type ExecutiveCooFactsSource,
} from "../facts/executive-coo-facts";
import {
  executiveCooSchema,
  type ExecutiveCooEnrichedOutput,
  type ExecutiveCooOutput,
} from "../schemas/executive-coo";
import { validateRecommendations } from "../validation/recommendation-validator";
import type { AgentDefinition } from "./agent-definition";
import { getExecutiveCooExecutionContext } from "./agent-execution-context";
import { buildExecutiveCooEvidenceCatalog } from "./executive-coo-evidence";
import {
  extractExecutiveCooPriorities,
  validateExecutiveCooBusinessRules,
} from "./executive-coo.validator";
import { createPrismaExecutiveCooFactsSource } from "../../services/executive-coo-facts.server";

class ExecutiveCooPromptBuilder implements PromptBuilder<ExecutiveCooFacts> {
  async build(input: PromptBuildInput<ExecutiveCooFacts>) {
    const executionContext = getExecutiveCooExecutionContext();
    const evidenceCatalog = buildExecutiveCooEvidenceCatalog(input.facts);

    if (executionContext) {
      executionContext.evidenceCatalog = evidenceCatalog;
    }

    return genericPromptBuilder.build({
      ...input,
      memoryContext: {
        ...(input.memoryContext ?? {}),
        evidenceCatalog,
        operationsHealthScore: input.facts.operationsHealthScore,
        storeHealthScore: input.facts.storeHealthScore,
        revenueOpportunity: input.facts.revenueOpportunity,
        inventoryRisk: input.facts.inventoryRisk,
        growthScore: input.facts.growthScore,
        strategySignals: input.facts.strategySignals,
        agentSnapshots: input.facts.agentSnapshots,
        specialistRecommendations: input.facts.specialistRecommendations,
        merchantOperationalPreferences: input.facts.merchantOperationalPreferences,
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

export function createExecutiveCooAgentDefinition(
  source: ExecutiveCooFactsSource = createPrismaExecutiveCooFactsSource(),
): AgentDefinition<ExecutiveCooFacts, typeof executiveCooSchema> {
  return {
    id: "executive_coo",
    promptId: "executive-coo",
    schema: executiveCooSchema,
    factBuilder: createExecutiveCooFactsBuilder(source),
    promptBuilder: new ExecutiveCooPromptBuilder(),
    validateBusinessRules: validateExecutiveCooBusinessRules,
    extractRecommendations: ({ output }) => {
      const candidates = extractExecutiveCooPriorities(output);
      validateRecommendations(candidates);
      return candidates;
    },
    buildFactContext() {
      return {};
    },
  };
}

export const executiveCooAgentDefinition = createExecutiveCooAgentDefinition();

export type { ExecutiveCooOutput, ExecutiveCooEnrichedOutput };
