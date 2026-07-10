import type { z } from "zod";

import { AIPlatformError } from "../../../core/ai-errors";
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

type AnthropicMessageResponse = {
  content?: Array<{ type?: string; text?: string }>;
  model?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
  stop_reason?: string | null;
};

export class AnthropicFoundationProvider {
  readonly id: FoundationProviderId = "anthropic";

  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  private get apiKey(): string {
    const key = this.env.ANTHROPIC_API_KEY?.trim();
    if (!key) {
      throw AIPlatformError.configuration("ANTHROPIC_API_KEY is required");
    }
    return key;
  }

  private get baseUrl(): string {
    return this.env.ANTHROPIC_BASE_URL?.trim() || "https://api.anthropic.com";
  }

  async generate(input: ProviderGenerateInput): Promise<ProviderGenerateResult> {
    const startedAt = Date.now();
    const response = await this.callMessagesApi(input, false);
    return {
      content: extractText(response),
      model: response.model ?? input.model,
      usage: mapUsage(response),
      finishReason: response.stop_reason ?? null,
      latencyMs: Date.now() - startedAt,
    };
  }

  async generateStructured<TSchema extends z.ZodTypeAny>(
    input: ProviderStructuredInput<TSchema>,
  ): Promise<ProviderStructuredResult<z.infer<TSchema>>> {
    const startedAt = Date.now();
    const response = await this.callMessagesApi(input, true);
    const rawContent = extractText(response);
    const parsed = validateStructuredOutput(
      input.schema,
      parseJsonSafely(extractJsonObject(rawContent)),
    );

    return {
      data: parsed.data,
      model: response.model ?? input.model,
      usage: mapUsage(response),
      finishReason: response.stop_reason ?? null,
      latencyMs: Date.now() - startedAt,
      rawContent,
    };
  }

  async healthCheck(): Promise<ProviderHealthStatus> {
    const startedAt = Date.now();
    try {
      await this.callMessagesApi(
        {
          model:
            this.env.AI_TIER_NANO_MODEL?.trim() || "claude-3-5-haiku-latest",
          messages: [{ role: "user", content: "ping" }],
          temperature: 0,
          maxTokens: 16,
          timeoutMs: 5_000,
        },
        false,
      );
      return {
        providerId: this.id,
        healthy: true,
        latencyMs: Date.now() - startedAt,
        message: "Anthropic reachable",
      };
    } catch (error) {
      return {
        providerId: this.id,
        healthy: false,
        latencyMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : "anthropic_unavailable",
      };
    }
  }

  capability(): ProviderCapability {
    return {
      supportsStructuredOutput: true,
      supportsJsonSchema: false,
      contextWindowTokens: parseOptionalNumber(
        this.env.AI_ANTHROPIC_CONTEXT_WINDOW_TOKENS,
      ),
    };
  }

  costRates(): ProviderCostRates {
    return {
      promptUsdPer1k: parseNumber(
        this.env.AI_ANTHROPIC_PROMPT_USD_PER_1K,
        0.003,
      ),
      completionUsdPer1k: parseNumber(
        this.env.AI_ANTHROPIC_COMPLETION_USD_PER_1K,
        0.015,
      ),
    };
  }

  private async callMessagesApi(
    input: ProviderGenerateInput,
    jsonMode: boolean,
  ): Promise<AnthropicMessageResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), input.timeoutMs);

    try {
      const systemMessage = input.messages.find((m) => m.role === "system");
      const nonSystemMessages = input.messages.filter((m) => m.role !== "system");

      const response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: input.model,
          max_tokens: input.maxTokens,
          temperature: input.temperature,
          system: systemMessage?.content,
          messages: nonSystemMessages.map((message) => ({
            role: message.role === "assistant" ? "assistant" : "user",
            content: message.content,
          })),
          ...(jsonMode
            ? {
                response_format: {
                  type: "json_object",
                },
              }
            : {}),
        }),
        signal: controller.signal,
      });

      if (response.status === 429) {
        throw AIPlatformError.rateLimited("Anthropic rate limited");
      }

      if (!response.ok) {
        const body = await response.text();
        throw AIPlatformError.providerUnavailable(
          `Anthropic request failed (${response.status}): ${body}`,
        );
      }

      return (await response.json()) as AnthropicMessageResponse;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw AIPlatformError.timeout("Anthropic request timed out");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function extractText(response: AnthropicMessageResponse): string {
  const text = response.content
    ?.map((block) => block.text ?? "")
    .join("")
    .trim();
  if (!text) {
    throw AIPlatformError.invalidResponse("Anthropic returned empty content");
  }
  return text;
}

function mapUsage(response: AnthropicMessageResponse) {
  const promptTokens = response.usage?.input_tokens ?? 0;
  const completionTokens = response.usage?.output_tokens ?? 0;
  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
  };
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

export function estimateAnthropicCost(input: {
  promptTokens: number;
  completionTokens: number;
  rates: ProviderCostRates;
}): number {
  return roundUsd(
    (input.promptTokens / 1000) * input.rates.promptUsdPer1k +
      (input.completionTokens / 1000) * input.rates.completionUsdPer1k,
  );
}
