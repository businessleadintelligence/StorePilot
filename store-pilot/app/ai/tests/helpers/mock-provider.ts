import type { z } from "zod";

import type { AIProvider } from "../../core/ai-provider";
import type {
  AICostEstimate,
  AICostEstimateRequest,
  AIGenerateRequest,
  AIGenerateResponse,
  AIHealthCheckResult,
  AIModelInfo,
  AIStructuredRequest,
  AIStructuredResponse,
} from "../../core/ai-types";
import { validateStructuredOutput } from "../../core/ai-output";

export type MockProviderHandlers = {
  generate?: AIProvider["generate"];
  generateStructured?: AIProvider["generateStructured"];
  healthCheck?: AIProvider["healthCheck"];
  estimateCost?: AIProvider["estimateCost"];
  modelInfo?: AIProvider["modelInfo"];
};

export function createMockAIProvider(
  id: string,
  handlers: MockProviderHandlers = {},
): AIProvider {
  return {
    id,
    generate:
      handlers.generate ??
      (async (request: AIGenerateRequest): Promise<AIGenerateResponse> => ({
        content: "mock-response",
        model: request.config.model,
        provider: id,
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        latencyMs: 5,
        finishReason: "stop",
      })),
    generateStructured:
      handlers.generateStructured ??
      (async <TSchema extends z.ZodTypeAny>(
        request: AIStructuredRequest<TSchema>,
      ): Promise<AIStructuredResponse<z.infer<TSchema>>> => {
        const validated = validateStructuredOutput(request.schema, {
          recommendation: "Improve inventory messaging for low stock",
          confidence: 0.82,
          impact: "medium",
          reasoning: "Titles lack keywords",
          priority: 3,
        });

        return {
          data: validated.data,
          model: request.config.model,
          provider: id,
          usage: { promptTokens: 12, completionTokens: 18, totalTokens: 30 },
          latencyMs: 7,
          finishReason: "stop",
          validationStatus: "valid",
        };
      }),
    healthCheck:
      handlers.healthCheck ??
      (async (): Promise<AIHealthCheckResult> => ({
        provider: id,
        healthy: true,
        latencyMs: 1,
      })),
    estimateCost:
      handlers.estimateCost ??
      (async (request: AICostEstimateRequest): Promise<AICostEstimate> => ({
        provider: id,
        model: request.config.model,
        promptTokens: request.promptTokens,
        completionTokens: request.completionTokens,
        estimatedCostUsd: 0.001,
        currency: "USD",
      })),
    modelInfo:
      handlers.modelInfo ??
      ((modelId: string): AIModelInfo => ({
        provider: id,
        model: modelId,
        supportsStructuredOutput: true,
        contextWindowTokens: 128_000,
      })),
  };
}
