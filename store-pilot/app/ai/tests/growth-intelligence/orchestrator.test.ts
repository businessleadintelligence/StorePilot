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
import { getAgentDefinition, listRegisteredAgents, registerAgentDefinition } from "../../agents/agent-registry";
import { createGrowthIntelligenceAgentDefinition } from "../../agents/growth-intelligence.agent";
import { growthIntelligenceSchema } from "../../schemas/growth-intelligence";
import {
  buildValidGrowthIntelligenceDraft,
  createMockGrowthIntelligenceSnapshot,
} from "./helpers";
import { executeGrowthIntelligence } from "../../../services/growth-intelligence.server";
import type { RegisteredAgentDefinition } from "../../agents/agent-definition";
import { createGrowthIntelligenceFactsBuilder } from "../../facts/growth-intelligence-facts";

vi.mock("../../telemetry/cost-control", () => ({
  assertAiBudgetAllowed: vi.fn(async () => ({
    allowed: true,
    consumed: 1,
    reason: null,
  })),
}));

function createTestOrchestrator(
  provider = createMockAIProvider("mock-provider"),
  persistence = createInMemoryAIPersistence(),
) {
  const telemetry = { write: vi.fn(async () => undefined) };

  const orchestrator = new AIOrchestrator({
    persistence,
    provider,
    config: loadAIConfig({
      provider: "mock-provider",
      model: "mock-model",
    }),
    loadPrompt: createFilePromptLoader({
      promptsDirectory: join(process.cwd(), "app", "ai", "prompts"),
    }).load,
    telemetry,
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

  return { orchestrator, persistence, telemetry };
}

describe("Growth Intelligence agent registration", () => {
  it("registers growth_intelligence in the agent registry", () => {
    const definition = getAgentDefinition("growth_intelligence");

    expect(definition.id).toBe("growth_intelligence");
    expect(definition.promptId).toBe("growth-intelligence");
    expect(definition.schema).toBe(growthIntelligenceSchema);
    expect(listRegisteredAgents().some((agent) => agent.id === "growth_intelligence")).toBe(true);
  });

  it("loads reasoning-only growth intelligence prompt instructions", async () => {
    const loader = createFilePromptLoader({
      promptsDirectory: join(process.cwd(), "app", "ai", "prompts"),
    });
    const prompt = await loader.load("growth-intelligence");

    expect(prompt.metadata.expectedSchema).toBe("growth-intelligence");
    expect(prompt.body).toContain("Never calculate growth scores");
    expect(prompt.body).toContain("Return JSON only");
  });
});

describe("Growth Intelligence orchestrator integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("executes through the platform pipeline with structured JSON output", async () => {
    const snapshot = createMockGrowthIntelligenceSnapshot();
    const factsBuilder = createGrowthIntelligenceFactsBuilder({
      async getGrowthIntelligenceSnapshot() {
        return snapshot;
      },
    });
    const facts = await factsBuilder.build({ storeId: "store-1", agentId: "growth_intelligence" });

    const provider = createMockAIProvider("mock-provider", {
      generateStructured: (async () => ({
        data: buildValidGrowthIntelligenceDraft(facts),
        model: "mock-model",
        provider: "mock-provider",
        usage: { promptTokens: 20, completionTokens: 40, totalTokens: 60 },
        latencyMs: 12,
        finishReason: "stop",
        validationStatus: "valid" as const,
      })) as NonNullable<import("../helpers/mock-provider").MockProviderHandlers["generateStructured"]>,
    });

    registerAgentDefinition(
      createGrowthIntelligenceAgentDefinition({
        async getGrowthIntelligenceSnapshot() {
          return snapshot;
        },
      }) as RegisteredAgentDefinition,
    );

    const persistence = createInMemoryAIPersistence();
    const { orchestrator } = createTestOrchestrator(provider, persistence);

    const result = await orchestrator.execute({
      agent: "growth_intelligence",
      storeId: "store-1",
      context: {
        subjectKey: "growth-intelligence:store-1",
      },
    });

    expect(result.status).toBe("succeeded");
    expect(result.result).toMatchObject({
      summary: expect.any(String),
      growthScore: facts.growthScore,
      healthExplanation: expect.objectContaining({
        score: facts.growthHealthScore,
      }),
      recommendations: expect.arrayContaining([
        expect.objectContaining({ id: "growth:upsell-campaign", evidence: expect.any(Array) }),
      ]),
    });
  });

  it("executes through the public executeGrowthIntelligence API", async () => {
    const snapshot = createMockGrowthIntelligenceSnapshot();
    const factsBuilder = createGrowthIntelligenceFactsBuilder({
      async getGrowthIntelligenceSnapshot() {
        return snapshot;
      },
    });
    const facts = await factsBuilder.build({ storeId: "store-1", agentId: "growth_intelligence" });

    const provider = createMockAIProvider("mock-provider", {
      generateStructured: (async () => ({
        data: buildValidGrowthIntelligenceDraft(facts),
        model: "mock-model",
        provider: "mock-provider",
        usage: { promptTokens: 20, completionTokens: 40, totalTokens: 60 },
        latencyMs: 12,
        finishReason: "stop",
        validationStatus: "valid" as const,
      })) as NonNullable<import("../helpers/mock-provider").MockProviderHandlers["generateStructured"]>,
    });

    registerAgentDefinition(
      createGrowthIntelligenceAgentDefinition({
        async getGrowthIntelligenceSnapshot() {
          return snapshot;
        },
      }) as RegisteredAgentDefinition,
    );

    const persistence = createInMemoryAIPersistence();
    const { orchestrator } = createTestOrchestrator(provider, persistence);

    const result = await executeGrowthIntelligence({
      storeId: "store-1",
      orchestrator,
      persistence,
      skipLifecycle: true,
      factsSource: {
        async getGrowthIntelligenceSnapshot() {
          return snapshot;
        },
      },
    });

    expect(result.status).toBe("succeeded");
    expect(result.result?.growthScore).toBe(facts.growthScore);
  });
});
