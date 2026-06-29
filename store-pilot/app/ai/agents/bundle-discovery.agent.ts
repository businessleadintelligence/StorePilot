import { genericPromptBuilder, type PromptBuildInput, type PromptBuilder } from "../builders/prompt-builder";
import {
  createBundleFactsBuilder,
  type BundleFacts,
  type BundleFactsSource,
} from "../facts/bundle-facts";
import {
  bundleIntelligenceSchema,
  type BundleIntelligenceEnrichedOutput,
  type BundleIntelligenceOutput,
} from "../schemas/bundle-intelligence";
import { validateRecommendations } from "../validation/recommendation-validator";
import type { AgentDefinition } from "./agent-definition";
import { getBundleDiscoveryExecutionContext } from "./agent-execution-context";
import { buildBundleEvidenceCatalog } from "./bundle-discovery-evidence";
import {
  extractBundleDiscoveryRecommendations,
  validateBundleDiscoveryBusinessRules,
} from "./bundle-discovery.validator";
import { createPrismaBundleFactsSource } from "../../services/bundle-intelligence-facts.server";

class BundleDiscoveryPromptBuilder implements PromptBuilder<BundleFacts> {
  async build(input: PromptBuildInput<BundleFacts>) {
    const executionContext = getBundleDiscoveryExecutionContext();
    const evidenceCatalog = buildBundleEvidenceCatalog(input.facts);

    if (executionContext) {
      executionContext.evidenceCatalog = evidenceCatalog;
    }

    return genericPromptBuilder.build({
      ...input,
      memoryContext: {
        ...(input.memoryContext ?? {}),
        evidenceCatalog,
        bundleCandidates: input.facts.bundleCandidates,
        coPurchasePairs: input.facts.coPurchasePairs,
        implementedBundleIds: input.facts.implementedBundleIds,
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

export function createBundleDiscoveryAgentDefinition(
  source: BundleFactsSource = createPrismaBundleFactsSource(),
): AgentDefinition<BundleFacts, typeof bundleIntelligenceSchema> {
  return {
    id: "bundle_discovery",
    promptId: "bundle-discovery",
    schema: bundleIntelligenceSchema,
    factBuilder: createBundleFactsBuilder(source),
    promptBuilder: new BundleDiscoveryPromptBuilder(),
    validateBusinessRules: validateBundleDiscoveryBusinessRules,
    extractRecommendations: ({ output }) => {
      const candidates = extractBundleDiscoveryRecommendations(output);
      validateRecommendations(candidates);
      return candidates;
    },
    buildFactContext() {
      return {};
    },
  };
}

export const bundleDiscoveryAgentDefinition = createBundleDiscoveryAgentDefinition();

export type { BundleIntelligenceOutput, BundleIntelligenceEnrichedOutput };
