import type { z } from "zod";

import type { FactBuilder } from "../facts/types";
import type { PromptBuilder } from "../builders/prompt-builder";
import type { RecommendationExtractor } from "../validation/recommendation-validator";

export type AgentId =
  | "product_intelligence"
  | "inventory_intelligence"
  | "bundle_discovery"
  | "executive_summary"
  | "seo_audit"
  | "store_audit"
  | "offer_intelligence"
  | "trend_intelligence"
  | "pricing_intelligence"
  | "growth_intelligence"
  | "executive_coo"
  | "platform_template";

export type AgentDefinition<TFacts = Record<string, unknown>, TSchema extends z.ZodTypeAny = z.ZodTypeAny> = {
  id: AgentId;
  promptId: string;
  schema: TSchema;
  factBuilder: FactBuilder<TFacts, Record<string, unknown>>;
  promptBuilder: PromptBuilder<TFacts>;
  validateBusinessRules?: (
    facts: TFacts,
    output: z.infer<TSchema>,
  ) => void | Promise<void>;
  extractRecommendations?: RecommendationExtractor<z.infer<TSchema>>;
  buildFactContext?: (context: Record<string, unknown>) => Record<string, unknown>;
};

export type RegisteredAgentDefinition = AgentDefinition<unknown, z.ZodTypeAny>;
