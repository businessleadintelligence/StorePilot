import type { z } from "zod";

import { validateStructuredOutput } from "../../../core/ai-output";
import type { FoundationProviderId } from "../../types/foundation-types";
import type {
  ProviderCapability,
  ProviderCostRates,
  ProviderGenerateInput,
  ProviderGenerateResult,
  ProviderHealthStatus,
  ProviderStructuredInput,
  ProviderStructuredResult,
} from "../../types/provider-types";
import { extractJsonObject, parseJsonSafely, roundUsd } from "../../utils/json";
import { createOpenAIClient } from "../../../providers/openai/openai-client";
import { mapOpenAIError } from "../../../providers/openai/openai-mapper";

export class OpenAIFoundationProvider {
  readonly id: FoundationProviderId = "openai";

  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  private get apiKey(): string {
    const key = this.env.OPENAI_API_KEY?.trim();
    if (!key) {
      throw mapOpenAIError(new Error("OPENAI_API_KEY_missing"));
    }
    return key;
  }

  private client(timeoutMs: number) {
    return createOpenAIClient({
      apiKey: this.apiKey,
      timeoutMs,
    });
  }

  async generate(input: ProviderGenerateInput): Promise<ProviderGenerateResult> {
    const startedAt = Date.now();
    try {
      const response = await this.client(input.timeoutMs).chat({
        model: input.model,
        messages: input.messages,
        temperature: input.temperature,
        maxTokens: input.maxTokens,
        responseFormat: "text",
      });
      return {
        content: response.content,
        model: response.model,
        usage: response.usage,
        finishReason: response.finishReason,
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      throw mapOpenAIError(error);
    }
  }

  async generateStructured<TSchema extends z.ZodTypeAny>(
    input: ProviderStructuredInput<TSchema>,
  ): Promise<ProviderStructuredResult<z.infer<TSchema>>> {
    const startedAt = Date.now();
    try {
      const response = await this.client(input.timeoutMs).chat({
        model: input.model,
        messages: input.messages,
        temperature: input.temperature,
        maxTokens: input.maxTokens,
        responseFormat: "json_object",
      });
      const rawContent = response.content;
      const parsed = validateStructuredOutput(
        input.schema,
        parseJsonSafely(extractJsonObject(rawContent)),
      );
      return {
        data: parsed.data,
        model: response.model,
        usage: response.usage,
        finishReason: response.finishReason,
        latencyMs: Date.now() - startedAt,
        rawContent,
      };
    } catch (error) {
      throw mapOpenAIError(error);
    }
  }

  async healthCheck(): Promise<ProviderHealthStatus> {
    const startedAt = Date.now();
    try {
      await this.client(5_000).ping(
        this.env.AI_TIER_NANO_MODEL?.trim() || "gpt-4.1-nano",
      );
      return {
        providerId: this.id,
        healthy: true,
        latencyMs: Date.now() - startedAt,
        message: "OpenAI reachable",
      };
    } catch (error) {
      const mapped = mapOpenAIError(error);
      return {
        providerId: this.id,
        healthy: false,
        latencyMs: Date.now() - startedAt,
        message: mapped.message,
      };
    }
  }

  capability(): ProviderCapability {
    return {
      supportsStructuredOutput: true,
      supportsJsonSchema: true,
      contextWindowTokens: parseOptionalNumber(
        this.env.AI_OPENAI_CONTEXT_WINDOW_TOKENS,
      ),
    };
  }

  costRates(): ProviderCostRates {
    return {
      promptUsdPer1k: parseNumber(
        this.env.AI_OPENAI_PROMPT_USD_PER_1K,
        0.0005,
      ),
      completionUsdPer1k: parseNumber(
        this.env.AI_OPENAI_COMPLETION_USD_PER_1K,
        0.0015,
      ),
    };
  }
}

function parseNumber(raw: string | undefined, fallback: number): number {
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

export function estimateProviderCost(input: {
  promptTokens: number;
  completionTokens: number;
  rates: ProviderCostRates;
}): number {
  return roundUsd(
    (input.promptTokens / 1000) * input.rates.promptUsdPer1k +
      (input.completionTokens / 1000) * input.rates.completionUsdPer1k,
  );
}
