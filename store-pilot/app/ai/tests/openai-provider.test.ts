import { describe, expect, it } from "vitest";

import { loadAIConfig } from "../core/ai-config";
import { productRecommendationSchema } from "../schemas";
import { OpenAIProvider } from "../providers/openai/openai-provider";
import { createMockOpenAIClient } from "../providers/openai/openai-client";
import { AIPlatformError } from "../core/ai-errors";

describe("OpenAI provider", () => {
  it("generates structured output and validates with zod", async () => {
    const provider = new OpenAIProvider({
      apiKey: "test-key",
      aiConfig: loadAIConfig({
        provider: "openai",
        model: "configured-model",
      }),
      client: createMockOpenAIClient({
        chat: async () => ({
          content: JSON.stringify({
            recommendation: "Improve inventory messaging",
            confidence: 0.88,
            impact: "high",
            reasoning: "Low stock already detected by StorePilot",
            priority: 1,
          }),
          model: "configured-model",
          finishReason: "stop",
          usage: { promptTokens: 20, completionTokens: 30, totalTokens: 50 },
        }),
      }),
      pricing: {
        promptUsdPer1k: 0.001,
        completionUsdPer1k: 0.002,
      },
    });

    const response = await provider.generateStructured({
      messages: [{ role: "user", content: "facts" }],
      config: {
        provider: "openai",
        model: "configured-model",
        temperature: 0.2,
        maxTokens: 1000,
        structuredOutputEnabled: true,
      },
      schema: productRecommendationSchema,
      schemaName: "product-recommendation",
    });

    expect(response.validationStatus).toBe("valid");
    expect(response.data.recommendation).toContain("inventory");
  });

  it("maps client failures to platform errors", async () => {
    const provider = new OpenAIProvider({
      apiKey: "test-key",
      aiConfig: loadAIConfig({
        provider: "openai",
        model: "configured-model",
      }),
      client: createMockOpenAIClient({
        chat: async () => {
          throw { status: 429, message: "Rate limit reached" };
        },
      }),
    });

    await expect(
      provider.generate({
        messages: [{ role: "user", content: "hello" }],
        config: {
          provider: "openai",
          model: "configured-model",
          temperature: 0.2,
          maxTokens: 100,
          structuredOutputEnabled: false,
        },
      }),
    ).rejects.toBeInstanceOf(AIPlatformError);
  });

  it("estimates cost from configured pricing", async () => {
    const provider = new OpenAIProvider({
      apiKey: "test-key",
      aiConfig: loadAIConfig({
        provider: "openai",
        model: "configured-model",
      }),
      client: createMockOpenAIClient(),
      pricing: {
        promptUsdPer1k: 1,
        completionUsdPer1k: 2,
      },
    });

    const estimate = await provider.estimateCost({
      config: {
        provider: "openai",
        model: "configured-model",
        temperature: 0.2,
        maxTokens: 1000,
        structuredOutputEnabled: true,
      },
      promptTokens: 1000,
      completionTokens: 500,
    });

    expect(estimate.estimatedCostUsd).toBe(2);
  });
});
