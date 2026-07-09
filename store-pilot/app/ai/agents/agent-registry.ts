import { buildFactFingerprint } from "../cache/fingerprint";
import { genericPromptBuilder } from "../builders/prompt-builder";
import { productRecommendationSchema, type ProductRecommendationOutput } from "../schemas";
import {
  extractRecommendationsFromSchemaOutput,
  validateRecommendations,
} from "../validation/recommendation-validator";
import type { AgentDefinition, RegisteredAgentDefinition } from "./agent-definition";
import { productIntelligenceAgentDefinition } from "./product-intelligence.agent";
import { inventoryIntelligenceAgentDefinition } from "./inventory-intelligence.agent";
import { bundleDiscoveryAgentDefinition } from "./bundle-discovery.agent";
import { storeAuditAgentDefinition } from "./store-audit.agent";
import { trendIntelligenceAgentDefinition } from "./trend-intelligence.agent";
import { seoIntelligenceAgentDefinition } from "./seo-intelligence.agent";
import { pricingIntelligenceAgentDefinition } from "./pricing-intelligence.agent";
import { growthIntelligenceAgentDefinition } from "./growth-intelligence.agent";
import { executiveCooAgentDefinition } from "./executive-coo.agent";

const passthroughFactBuilder = {
  agentId: "platform_template",
  async build(context: { storeId: string; facts?: Record<string, unknown> }) {
    return context.facts ?? { storeId: context.storeId };
  },
  fingerprint(facts: Record<string, unknown>) {
    return buildFactFingerprint(facts);
  },
};

export const platformTemplateAgentDefinition: AgentDefinition<
  Record<string, unknown>,
  typeof productRecommendationSchema
> = {
  id: "platform_template",
  promptId: "platform.template",
  schema: productRecommendationSchema,
  factBuilder: passthroughFactBuilder,
  promptBuilder: genericPromptBuilder,
  validateBusinessRules(_facts, output: ProductRecommendationOutput) {
    if (output.confidence < 0 || output.confidence > 1) {
      throw new Error("invalid_confidence");
    }
  },
  extractRecommendations: ({ output }) => {
    const candidates = extractRecommendationsFromSchemaOutput(
      output as unknown as Record<string, unknown>,
    );
    if (candidates.length > 0) {
      validateRecommendations(candidates);
      return candidates;
    }

    return [
      {
        category: "general",
        title: output.recommendation,
        summary: output.reasoning,
        priority: output.priority,
        confidence: output.confidence,
        payload: output as unknown as Record<string, unknown>,
      },
    ];
  },
  buildFactContext(context) {
    return { facts: context.facts ?? context };
  },
};

const registry = new Map<string, RegisteredAgentDefinition>([
  ["platform_template", platformTemplateAgentDefinition as RegisteredAgentDefinition],
  ["product_intelligence", productIntelligenceAgentDefinition as RegisteredAgentDefinition],
  ["inventory_intelligence", inventoryIntelligenceAgentDefinition as RegisteredAgentDefinition],
  ["bundle_discovery", bundleDiscoveryAgentDefinition as RegisteredAgentDefinition],
  ["store_audit", storeAuditAgentDefinition as RegisteredAgentDefinition],
  ["trend_intelligence", trendIntelligenceAgentDefinition as RegisteredAgentDefinition],
  ["seo_audit", seoIntelligenceAgentDefinition as RegisteredAgentDefinition],
  ["pricing_intelligence", pricingIntelligenceAgentDefinition as RegisteredAgentDefinition],
  ["growth_intelligence", growthIntelligenceAgentDefinition as RegisteredAgentDefinition],
  ["executive_coo", executiveCooAgentDefinition as RegisteredAgentDefinition],
]);

export function registerAgentDefinition(definition: RegisteredAgentDefinition): void {
  registry.set(definition.id, definition);
}

export function getAgentDefinition(agentId: string): RegisteredAgentDefinition {
  const definition = registry.get(agentId);
  if (!definition) {
    throw new Error(`agent_not_registered:${agentId}`);
  }

  return definition;
}

export function listRegisteredAgents(): RegisteredAgentDefinition[] {
  return [...registry.values()];
}
