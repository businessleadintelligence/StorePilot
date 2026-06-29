import type { z } from "zod";

import type {
  AICostEstimate,
  AICostEstimateRequest,
  AIGenerateRequest,
  AIGenerateResponse,
  AIHealthCheckResult,
  AIModelInfo,
  AIStructuredRequest,
  AIStructuredResponse,
} from "./ai-types";

export interface AIProvider {
  readonly id: string;

  generate(request: AIGenerateRequest): Promise<AIGenerateResponse>;

  generateStructured<TSchema extends z.ZodTypeAny>(
    request: AIStructuredRequest<TSchema>,
  ): Promise<AIStructuredResponse<z.infer<TSchema>>>;

  healthCheck(): Promise<AIHealthCheckResult>;

  estimateCost(request: AICostEstimateRequest): Promise<AICostEstimate>;

  modelInfo(modelId: string): AIModelInfo;
}

export type AIProviderFactory = (config: {
  apiKey?: string;
}) => AIProvider;
