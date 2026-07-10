import type { z } from "zod";

import { AIPlatformError } from "../core/ai-errors";
import type { AIStructuredResponse } from "../core/ai-types";
import { createDefaultPromptRegistry } from "./prompt-registry";
import { createFoundationPipeline } from "./pipeline";
import type {
  FoundationRequestContext,
  FoundationTaskCategory,
} from "./types/foundation-types";

const orchestratorPipeline = createFoundationPipeline({
  promptRegistry: createDefaultPromptRegistry(),
});

const AGENT_TASK_CATEGORY: Record<string, FoundationTaskCategory> = {
  executive_coo: "executive_reasoning",
  store_audit: "cross_system_diagnosis",
  product_intelligence: "recommendation_generation",
  inventory_intelligence: "recommendation_generation",
  bundle_discovery: "recommendation_generation",
  trend_intelligence: "recommendation_generation",
  seo_audit: "recommendation_generation",
  pricing_intelligence: "recommendation_generation",
  growth_intelligence: "recommendation_generation",
  platform_template: "recommendation_generation",
};

export type OrchestratorStructuredExecuteInput<TSchema extends z.ZodTypeAny = z.ZodTypeAny> = {
  promptId: string;
  storeId: string;
  merchantId?: string;
  agentId: string;
  feature: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  schema: TSchema;
  schemaName: string;
};

export async function executeStructuredViaFoundation<TSchema extends z.ZodTypeAny>(
  input: OrchestratorStructuredExecuteInput<TSchema>,
): Promise<AIStructuredResponse<z.infer<TSchema>>> {
  const context: FoundationRequestContext = {
    storeId: input.storeId,
    merchantId: input.merchantId,
    agentId: input.agentId,
    feature: input.feature,
    taskCategory:
      AGENT_TASK_CATEGORY[input.agentId] ?? "recommendation_generation",
  };

  const response = await orchestratorPipeline.execute({
    promptId: input.promptId,
    messages: input.messages,
    context,
    output: {
      schema: input.schema,
      schemaName: input.schemaName,
    },
    forceRefresh: true,
    useDirectMessages: true,
  });

  if (!response.ok) {
    throw AIPlatformError.agentExecution(
      input.agentId,
      response.message,
      response.errorCode,
    );
  }

  return {
    data: response.data,
    model: response.modelId,
    provider: response.providerId,
    usage: response.usage,
    latencyMs: response.latencyMs,
    finishReason: "stop",
    validationStatus: "valid",
    rawMetadata: {
      requestId: response.requestId,
      promptVersion: response.promptVersion,
      estimatedCostUsd: response.estimatedCostUsd,
      retryCount: response.retryCount,
      validationRetries: response.validationRetries,
      downgradedTier: response.downgradedTier,
    },
  };
}
