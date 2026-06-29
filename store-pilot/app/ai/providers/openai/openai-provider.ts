import type { z } from "zod";

import type { AIConfig } from "../../core/ai-config";
import { AIPlatformError } from "../../core/ai-errors";
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
import { createOpenAIClient, type OpenAIClient } from "./openai-client";
import {
  buildOpenAIModelInfo,
  mapOpenAIError,
  parseStructuredContent,
} from "./openai-mapper";

export type OpenAIProviderConfig = {
  apiKey: string;
  aiConfig: AIConfig;
  client?: OpenAIClient;
  pricing?: {
    promptUsdPer1k: number;
    completionUsdPer1k: number;
  };
  modelMetadata?: {
    contextWindowTokens: number | null;
    supportsStructuredOutput: boolean;
    description?: string;
  };
};

export class OpenAIProvider implements AIProvider {
  readonly id = "openai";

  private readonly client: OpenAIClient;
  private readonly pricing: {
    promptUsdPer1k: number;
    completionUsdPer1k: number;
  };
  private readonly modelMetadata: {
    contextWindowTokens: number | null;
    supportsStructuredOutput: boolean;
    description?: string;
  };

  constructor(private readonly config: OpenAIProviderConfig) {
    if (!config.apiKey.trim()) {
      throw AIPlatformError.configuration("OPENAI_API_KEY is required for OpenAI provider");
    }

    this.client =
      config.client ??
      createOpenAIClient({
        apiKey: config.apiKey,
        timeoutMs: config.aiConfig.timeoutMs,
      });

    this.pricing = config.pricing ?? {
      promptUsdPer1k: parsePricingEnv("AI_OPENAI_PROMPT_USD_PER_1K", 0),
      completionUsdPer1k: parsePricingEnv("AI_OPENAI_COMPLETION_USD_PER_1K", 0),
    };

    this.modelMetadata = config.modelMetadata ?? {
      contextWindowTokens: parseOptionalNumber(process.env.AI_OPENAI_CONTEXT_WINDOW_TOKENS),
      supportsStructuredOutput: true,
      description: process.env.AI_OPENAI_MODEL_DESCRIPTION,
    };
  }

  async generate(request: AIGenerateRequest): Promise<AIGenerateResponse> {
    const startedAt = Date.now();

    try {
      const response = await this.client.chat({
        model: request.config.model,
        messages: request.messages,
        temperature: request.config.temperature,
        maxTokens: request.config.maxTokens,
        responseFormat: "text",
      });

      return {
        content: response.content,
        model: response.model,
        provider: this.id,
        usage: response.usage,
        latencyMs: Date.now() - startedAt,
        finishReason: response.finishReason,
      };
    } catch (error) {
      throw mapOpenAIError(error);
    }
  }

  async generateStructured<TSchema extends z.ZodTypeAny>(
    request: AIStructuredRequest<TSchema>,
  ): Promise<AIStructuredResponse<z.infer<TSchema>>> {
    const startedAt = Date.now();

    if (!request.config.structuredOutputEnabled) {
      throw AIPlatformError.configuration("Structured output is disabled in AI configuration");
    }

    try {
      const response = await this.client.chat({
        model: request.config.model,
        messages: request.messages,
        temperature: request.config.temperature,
        maxTokens: request.config.maxTokens,
        responseFormat: "json_object",
      });

      const parsedPayload = parseStructuredContent<unknown>(response.content);
      const validated = validateStructuredOutput(request.schema, parsedPayload);

      return {
        data: validated.data,
        model: response.model,
        provider: this.id,
        usage: response.usage,
        latencyMs: Date.now() - startedAt,
        finishReason: response.finishReason,
        validationStatus: validated.validationStatus,
        rawMetadata: {
          schemaName: request.schemaName,
        },
      };
    } catch (error) {
      throw mapOpenAIError(error);
    }
  }

  async healthCheck(): Promise<AIHealthCheckResult> {
    const startedAt = Date.now();

    try {
      await this.client.ping(this.config.aiConfig.model);
      return {
        provider: this.id,
        healthy: true,
        latencyMs: Date.now() - startedAt,
        message: "OpenAI provider reachable",
      };
    } catch (error) {
      const mapped = mapOpenAIError(error);
      return {
        provider: this.id,
        healthy: false,
        latencyMs: Date.now() - startedAt,
        message: mapped.message,
      };
    }
  }

  async estimateCost(request: AICostEstimateRequest): Promise<AICostEstimate> {
    const promptCost = (request.promptTokens / 1000) * this.pricing.promptUsdPer1k;
    const completionCost =
      (request.completionTokens / 1000) * this.pricing.completionUsdPer1k;

    return {
      provider: this.id,
      model: request.config.model,
      promptTokens: request.promptTokens,
      completionTokens: request.completionTokens,
      estimatedCostUsd: roundUsd(promptCost + completionCost),
      currency: "USD",
    };
  }

  modelInfo(modelId: string): AIModelInfo {
    return buildOpenAIModelInfo({
      model: modelId,
      supportsStructuredOutput: this.modelMetadata.supportsStructuredOutput,
      contextWindowTokens: this.modelMetadata.contextWindowTokens,
      description: this.modelMetadata.description,
    });
  }
}

function parsePricingEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw?.trim()) {
    return fallback;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseOptionalNumber(raw: string | undefined): number | null {
  if (!raw?.trim()) {
    return null;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function createOpenAIProvider(config: OpenAIProviderConfig): OpenAIProvider {
  return new OpenAIProvider(config);
}
