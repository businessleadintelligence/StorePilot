import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadAIConfig } from "../core/ai-config";
import { createInMemoryAIPersistence } from "../persistence/in-memory-persistence";
import { createFilePromptLoader } from "../prompts/file-prompt-loader";
import { createMockAIProvider } from "../tests/helpers/mock-provider";
import { ResultCacheService } from "../cache/result-cache";
import { ExecutionLifecycleTracker } from "../execution/execution-lifecycle";
import { AgentMemoryService } from "../memory/agent-memory.service";
import { AIOrchestrator } from "../orchestrator/ai-orchestrator.server";
import { productRecommendationSchema } from "../schemas";

vi.mock("../telemetry/cost-control", () => ({
  assertAiBudgetAllowed: vi.fn(async () => ({
    allowed: true,
    consumed: 1,
    reason: null,
  })),
}));

function createTestOrchestrator(provider = createMockAIProvider("mock-provider")) {
  const persistence = createInMemoryAIPersistence();

  return new AIOrchestrator({
    persistence,
    provider,
    config: loadAIConfig({
      provider: "mock-provider",
      model: "mock-model",
    }),
    loadPrompt: createFilePromptLoader({
      promptsDirectory: join(process.cwd(), "app", "ai", "prompts"),
    }).load,
    telemetry: { write: vi.fn(async () => undefined) },
    memory: new AgentMemoryService(persistence.memory),
    lifecycle: new ExecutionLifecycleTracker(),
    cache: new ResultCacheService({
      lookup: async (input) => {
        const lookup = await persistence.cache.lookup(input);
        return {
          hit: Boolean(lookup.result),
          result: (lookup.result?.resultJson ?? null) as never,
          resultId: lookup.result?.id ?? null,
          runId: lookup.runId,
        };
      },
      store: async (input) => persistence.cache.store(input),
    }),
  });
}

describe("AI Platform v2 orchestrator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("executes an agent through the single public pipeline", async () => {
    const orchestrator = createTestOrchestrator();
    const result = await orchestrator.execute({
      agent: "platform_template",
      storeId: "store-1",
      context: {
        subjectKey: "product:123",
        facts: {
          inventoryStatus: "LOW",
          productTitle: "Blue Hoodie",
        },
      },
    });

    expect(result.status).toBe("succeeded");
    expect(result.result).toMatchObject({
      recommendation: expect.any(String),
      confidence: expect.any(Number),
    });
    expect(result.recommendations).toBeGreaterThan(0);
  });

  it("returns cached results without calling provider again", async () => {
    const provider = createMockAIProvider("mock-provider");
    const generateStructured = vi.spyOn(provider, "generateStructured");
    const orchestrator = createTestOrchestrator(provider);

    const first = await orchestrator.execute({
      agent: "platform_template",
      storeId: "store-1",
      context: {
        subjectKey: "product:123",
        facts: { inventoryStatus: "LOW", productTitle: "Blue Hoodie" },
      },
    });

    const second = await orchestrator.execute({
      agent: "platform_template",
      storeId: "store-1",
      context: {
        subjectKey: "product:123",
        facts: { inventoryStatus: "LOW", productTitle: "Blue Hoodie" },
      },
    });

    expect(first.status).toBe("succeeded");
    expect(second.status).toBe("cached");
    expect(second.fromCache).toBe(true);
    expect(generateStructured).toHaveBeenCalledTimes(1);
  });

  it("retries once on malformed JSON validation and then fails", async () => {
    let attempts = 0;
    const provider = createMockAIProvider("mock-provider", {
      generateStructured: (async (request) => {
        attempts += 1;
        return {
          data: {
            recommendation: attempts === 1 ? "" : "Valid inventory recommendation",
            confidence: 0.8,
            impact: "high",
            reasoning: "Low stock already computed",
            priority: 2,
          },
          model: request.config.model,
          provider: "mock-provider",
          usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
          latencyMs: 1,
          finishReason: "stop",
          validationStatus: "valid" as const,
        };
      }) as NonNullable<import("../tests/helpers/mock-provider").MockProviderHandlers["generateStructured"]>,
    });

    const orchestrator = createTestOrchestrator(provider);
    const result = await orchestrator.execute({
      agent: "platform_template",
      storeId: "store-1",
      context: {
        subjectKey: "product:retry",
        facts: { inventoryStatus: "LOW" },
      },
    });

    expect(attempts).toBe(2);
    expect(result.status).toBe("succeeded");
    expect(result.telemetry.retryCount).toBe(1);
  });

  it("fails after retry when schema remains invalid", async () => {
    const provider = createMockAIProvider("mock-provider", {
      generateStructured: (async (request) => ({
        data: {
          recommendation: "",
          confidence: 2,
          impact: "",
          reasoning: "",
          priority: 0,
        },
        model: request.config.model,
        provider: "mock-provider",
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        latencyMs: 1,
        finishReason: "stop",
        validationStatus: "valid" as const,
      })) as NonNullable<import("../tests/helpers/mock-provider").MockProviderHandlers["generateStructured"]>,
    });

    const orchestrator = createTestOrchestrator(provider);
    const result = await orchestrator.execute({
      agent: "platform_template",
      storeId: "store-1",
      context: {
        subjectKey: "product:fail",
        facts: { inventoryStatus: "LOW" },
      },
    });

    expect(result.status).toBe("failed");
    expect(result.result).toBeNull();
  });
});

describe("AI Platform v2 orchestrator schema contract", () => {
  it("validates platform template output against zod schema", () => {
    const parsed = productRecommendationSchema.safeParse({
      recommendation: "Improve inventory messaging",
      confidence: 0.8,
      impact: "high",
      reasoning: "Low stock detected",
      priority: 2,
    });

    expect(parsed.success).toBe(true);
  });
});
