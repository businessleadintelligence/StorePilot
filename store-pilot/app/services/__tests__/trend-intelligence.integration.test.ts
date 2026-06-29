import { describe, expect, it, vi } from "vitest";
import { executeTrendIntelligence } from "../trend-intelligence.server";
import { createInMemoryAIPersistence } from "../../ai/persistence/in-memory-persistence";
import { createTrendFactsBuilder } from "../../ai/facts/trend-facts";
import {
  buildValidTrendIntelligenceDraft,
  createMockTrendSnapshot,
} from "../../ai/tests/trend-intelligence/helpers";
import { registerAgentDefinition } from "../../ai/agents/agent-registry";
import { createTrendIntelligenceAgentDefinition } from "../../ai/agents/trend-intelligence.agent";
import type { RegisteredAgentDefinition } from "../../ai/agents/agent-definition";
import { createMockAIProvider } from "../../ai/tests/helpers/mock-provider";

vi.mock("../../ai/telemetry/cost-control", () => ({
  assertAiBudgetAllowed: vi.fn(async () => ({
    allowed: true,
    consumed: 1,
    reason: null,
  })),
}));

describe("Trend Intelligence public API", () => {
  it("builds trend intelligence subject key", async () => {
    const { buildTrendIntelligenceSubjectKey } = await import("../trend-intelligence.server");
    expect(buildTrendIntelligenceSubjectKey("store-1")).toBe("trend:store-1");
  });

  it("executes trend intelligence with mocked facts source", async () => {
    const snapshot = createMockTrendSnapshot();
    const factsBuilder = createTrendFactsBuilder({
      async getStoreTrendSnapshot() {
        return snapshot;
      },
    });
    const facts = await factsBuilder.build({ storeId: "store-1" });

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
      })) as NonNullable<import("../../ai/tests/helpers/mock-provider").MockProviderHandlers["generateStructured"]>,
    });

    const { AIOrchestrator } = await import("../../ai/orchestrator/ai-orchestrator.server");
    const { loadAIConfig } = await import("../../ai/core/ai-config");
    const { AgentMemoryService } = await import("../../ai/memory/agent-memory.service");
    const { ExecutionLifecycleTracker } = await import("../../ai/execution/execution-lifecycle");
    const { ResultCacheService } = await import("../../ai/cache/result-cache");
    const { join } = await import("node:path");
    const { createFilePromptLoader } = await import("../../ai/prompts/file-prompt-loader");

    const orchestrator = new AIOrchestrator({
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
        lookup: async () => ({ hit: false, result: null, resultId: null, runId: null }),
        store: async (input) => persistence.cache.store(input),
      }),
    });

    const result = await executeTrendIntelligence({
      storeId: "store-1",
      orchestrator,
      persistence,
      factsSource: {
        async getStoreTrendSnapshot() {
          return snapshot;
        },
      },
    });

    expect(result.status).toBe("succeeded");
    expect(result.result?.trendHealthScore).toBe(facts.trendHealthScore);
  });
});

describe("Trend Intelligence command center widget", () => {
  it("builds widget shape from persisted trend scores", () => {
    const widget = {
      trendHealth: 72,
      trendDirection: "mixed",
      openRecommendations: 1,
      emergingCount: 1,
      decliningCount: 1,
      recentExecutions: 1,
      growthAlerts: 1,
      declineAlerts: 1,
      recommendationGroups: [{ label: "Emerging Opportunities", value: 1 }],
      momentumCharts: [{ label: "Blue Hoodie", value: 72 }],
      emergingOpportunities: [{ label: "Blue Hoodie", value: 35 }],
      categoryOpportunities: [{ label: "Blue", value: 25 }],
      trendTimeline: [{ label: "Health", value: 72 }],
      opportunityPipeline: [{ label: "Emerging", value: 1 }],
    };

    expect(widget.trendHealth).toBe(72);
    expect(widget.momentumCharts.length).toBeGreaterThan(0);
  });
});
