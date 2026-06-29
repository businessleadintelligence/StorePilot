import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { z } from "zod";

import { AIPlatformError } from "../core/ai-errors";
import { ConsoleAILogger } from "../core/ai-logger";
import { loadAIConfig } from "../core/ai-config";
import { AIRunner } from "../core/ai-runner";
import type { AIStructuredRequest, AIStructuredResponse } from "../core/ai-types";
import { createFilePromptLoader } from "../prompts/file-prompt-loader";
import { productRecommendationSchema } from "../schemas";
import { createMockAIProvider } from "./helpers/mock-provider";
import { TemplateTestAgent } from "./helpers/template-test-agent";

describe("AI runner dependency injection", () => {
  it("runs an agent through an injected provider without provider-specific imports", async () => {
    const provider = createMockAIProvider("mock-provider");
    const generateStructured = vi.spyOn(provider, "generateStructured");

    const runner = new AIRunner({
      provider,
      config: loadAIConfig({
        provider: "mock-provider",
        model: "mock-model",
      }),
      logger: new ConsoleAILogger(),
      loadPrompt: createFilePromptLoader({
        promptsDirectory: join(process.cwd(), "app", "ai", "prompts"),
      }).load,
    });

    const agent = new TemplateTestAgent({ provider });
    const result = await runner.runAgent(agent, {
      storeId: "store-1",
      input: {
        inventoryStatus: "LOW",
        productTitle: "Blue Hoodie",
      },
    });

    expect(generateStructured).toHaveBeenCalledOnce();
    expect(result.agentId).toBe("template-test-agent");
    expect(result.output.recommendation).toContain("inventory");
  });

  it("fails when business rule validation rejects model output", async () => {
    const provider = createMockAIProvider("mock-provider", {
      generateStructured: async (request: AIStructuredRequest<typeof productRecommendationSchema>) => ({
        data: {
          recommendation: "Refresh homepage hero",
          confidence: 0.7,
          impact: "medium",
          reasoning: "Homepage underperforming",
          priority: 2,
        },
        model: request.config.model,
        provider: "mock-provider",
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        latencyMs: 1,
        finishReason: "stop",
        validationStatus: "valid",
      }),
    } as NonNullable<Parameters<typeof createMockAIProvider>[1]>);

    const runner = new AIRunner({
      provider,
      config: loadAIConfig({
        provider: "mock-provider",
        model: "mock-model",
      }),
      logger: new ConsoleAILogger(),
      loadPrompt: createFilePromptLoader({
        promptsDirectory: join(process.cwd(), "app", "ai", "prompts"),
      }).load,
    });

    const agent = new TemplateTestAgent({ provider });

    await expect(
      runner.runAgent(agent, {
        storeId: "store-1",
        input: {
          inventoryStatus: "LOW",
          productTitle: "Blue Hoodie",
        },
      }),
    ).rejects.toBeInstanceOf(AIPlatformError);
  });
});
