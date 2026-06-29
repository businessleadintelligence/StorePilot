import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadAIConfig } from "../../core/ai-config";
import { createInMemoryAIPersistence } from "../../persistence/in-memory-persistence";
import { createFilePromptLoader } from "../../prompts/file-prompt-loader";
import { createMockAIProvider } from "../helpers/mock-provider";
import { ResultCacheService } from "../../cache/result-cache";
import { ExecutionLifecycleTracker } from "../../execution/execution-lifecycle";
import { AgentMemoryService } from "../../memory/agent-memory.service";
import { AIOrchestrator } from "../../orchestrator/ai-orchestrator.server";
import { getAgentDefinition, registerAgentDefinition } from "../../agents/agent-registry";
import { createTrendIntelligenceAgentDefinition } from "../../agents/trend-intelligence.agent";
import { trendIntelligenceSchema } from "../../schemas/trend-intelligence";
import { createTrendFactsBuilder } from "../../facts/trend-facts";
import { buildValidTrendIntelligenceDraft, createMockTrendSnapshot } from "./helpers";
import { executeTrendIntelligence } from "../../../services/trend-intelligence.server";
import type { RegisteredAgentDefinition } from "../../agents/agent-definition";

vi.mock("../../telemetry/cost-control", () => ({
  assertAiBudgetAllowed: vi.fn(async () => ({ allowed: true, consumed: 1, reason: null })),
}));

function createTestOrchestrator(
  provider = createMockAIProvider("mock-provider"),
  persistence = createInMemoryAIPersistence(),
) {
  return new AIOrchestrator({
    persistence,
    provider,
    config: loadAIConfig({ provider: "mock-provider", model: "mock-model" }),
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

describe("Trend Intelligence agent registration", () => {
  it("registers trend_intelligence in the agent registry", () => {
    const definition = getAgentDefinition("trend_intelligence");
    expect(definition.id).toBe("trend_intelligence");
    expect(definition.promptId).toBe("trend-intelligence");
    expect(definition.schema).toBe(trendIntelligenceSchema);
  });
});

describe("Trend Intelligence orchestrator integration", () => {
  beforeEach(() => vi.clearAllMocks());

  it("executes through the platform pipeline", async () => {
    const snapshot = createMockTrendSnapshot();
    const factsBuilder = createTrendFactsBuilder({
      async getStoreTrendSnapshot() {
        return snapshot;
      },
    });
    const facts = await factsBuilder.build({ storeId: "store-1" });
    const provider = createMockAIProvider("mock-provider", {
      generateStructured: (async () => ({
        data: buildValidTrendIntelligenceDraft({
          trendHealthScore: facts.trendHealthScore,
          trendDirection: facts.trendDirection,
          products: facts.products,
          emergingProductIds: facts.emergingProductIds,
          decliningProductIds: facts.decliningProductIds,
          seasonalSignals: facts.seasonalSignals,
        }),
        model: "mock-model",
        provider: "mock-provider",
        usage: { promptTokens: 20, completionTokens: 40, totalTokens: 60 },
        latencyMs: 12,
        finishReason: "stop",
        validationStatus: "valid" as const,
      })) as NonNullable<import("../helpers/mock-provider").MockProviderHandlers["generateStructured"]>,
    });

    registerAgentDefinition(
      createTrendIntelligenceAgentDefinition({
        async getStoreTrendSnapshot() {
          return snapshot;
        },
      }) as RegisteredAgentDefinition,
    );

    const persistence = createInMemoryAIPersistence();
    const orchestrator = createTestOrchestrator(provider, persistence);
    const result = await orchestrator.execute({
      agent: "trend_intelligence",
      storeId: "store-1",
      context: { subjectKey: "trend:store-1" },
    });

    expect(result.status).toBe("succeeded");
    expect(result.result).toMatchObject({
      summary: expect.any(String),
      trendHealthScore: facts.trendHealthScore,
      trendDirection: facts.trendDirection,
      recommendations: expect.arrayContaining([
        expect.objectContaining({ id: "trend:restock-blue-hoodie", evidence: expect.any(Array) }),
      ]),
    });
  });

  it("executes through executeTrendIntelligence API", async () => {
    const snapshot = createMockTrendSnapshot();
    const facts = await createTrendFactsBuilder({
      async getStoreTrendSnapshot() {
        return snapshot;
      },
    }).build({ storeId: "store-1" });

    registerAgentDefinition(
      createTrendIntelligenceAgentDefinition({
        async getStoreTrendSnapshot() {
          return snapshot;
        },
      }) as RegisteredAgentDefinition,
    );

    const persistence = createInMemoryAIPersistence();
    const provider = createMockAIProvider("mock-provider", {
      generateStructured: (async () => ({
        data: buildValidTrendIntelligenceDraft({
          trendHealthScore: facts.trendHealthScore,
          trendDirection: facts.trendDirection,
          products: facts.products,
          emergingProductIds: facts.emergingProductIds,
          decliningProductIds: facts.decliningProductIds,
          seasonalSignals: facts.seasonalSignals,
        }),
        model: "mock-model",
        provider: "mock-provider",
        usage: { promptTokens: 20, completionTokens: 40, totalTokens: 60 },
        latencyMs: 12,
        finishReason: "stop",
        validationStatus: "valid" as const,
      })) as NonNullable<import("../helpers/mock-provider").MockProviderHandlers["generateStructured"]>,
    });

    const result = await executeTrendIntelligence({
      storeId: "store-1",
      orchestrator: createTestOrchestrator(provider, persistence),
      persistence,
      factsSource: { async getStoreTrendSnapshot() { return snapshot; } },
    });

    expect(result.status).toBe("succeeded");
  });
});
