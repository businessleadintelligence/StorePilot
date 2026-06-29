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
import { createPricingIntelligenceAgentDefinition } from "../../agents/pricing-intelligence.agent";
import { pricingIntelligenceSchema } from "../../schemas/pricing-intelligence";
import {
  buildValidPricingIntelligenceDraft,
  createMockPricingIntelligenceSnapshot,
} from "./helpers";
import { executePricingIntelligence } from "../../../services/pricing-intelligence.server";
import type { RegisteredAgentDefinition } from "../../agents/agent-definition";
import { createPricingIntelligenceFactsBuilder } from "../../facts/pricing-intelligence-facts";

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

describe("Pricing Intelligence agent registration", () => {
  it("registers pricing_intelligence in the agent registry", () => {
    const definition = getAgentDefinition("pricing_intelligence");

    expect(definition.id).toBe("pricing_intelligence");
    expect(definition.promptId).toBe("pricing-intelligence");
    expect(definition.schema).toBe(pricingIntelligenceSchema);
    expect(listRegisteredAgents().some((agent) => agent.id === "pricing_intelligence")).toBe(true);
  });

  it("loads reasoning-only pricing intelligence prompt instructions", async () => {
    const loader = createFilePromptLoader({
      promptsDirectory: join(process.cwd(), "app", "ai", "prompts"),
    });
    const prompt = await loader.load("pricing-intelligence");

    expect(prompt.metadata.expectedSchema).toBe("pricing-intelligence");
    expect(prompt.body).toContain("Never calculate pricing scores");
    expect(prompt.body).toContain("Return JSON only");
  });
});

describe("Pricing Intelligence orchestrator integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("executes through the platform pipeline with structured JSON output", async () => {
    const snapshot = createMockPricingIntelligenceSnapshot();
    const factsBuilder = createPricingIntelligenceFactsBuilder({
      async getPricingIntelligenceSnapshot() {
        return snapshot;
      },
    });
    const facts = await factsBuilder.build({ storeId: "store-1", agentId: "pricing_intelligence" });

    const provider = createMockAIProvider("mock-provider", {
      generateStructured: (async () => ({
        data: buildValidPricingIntelligenceDraft(facts),
        model: "mock-model",
        provider: "mock-provider",
        usage: { promptTokens: 20, completionTokens: 40, totalTokens: 60 },
        latencyMs: 12,
        finishReason: "stop",
        validationStatus: "valid" as const,
      })) as NonNullable<import("../helpers/mock-provider").MockProviderHandlers["generateStructured"]>,
    });

    registerAgentDefinition(
      createPricingIntelligenceAgentDefinition({
        async getPricingIntelligenceSnapshot() {
          return snapshot;
        },
      }) as RegisteredAgentDefinition,
    );

    const persistence = createInMemoryAIPersistence();
    const { orchestrator } = createTestOrchestrator(provider, persistence);

    const result = await orchestrator.execute({
      agent: "pricing_intelligence",
      storeId: "store-1",
      context: {
        subjectKey: "pricing-intelligence:store-1",
      },
    });

    expect(result.status).toBe("succeeded");
    expect(result.result).toMatchObject({
      summary: expect.any(String),
      pricingHealthScore: facts.pricingHealthScore,
      healthExplanation: expect.objectContaining({
        score: facts.pricingHealthScore,
      }),
      recommendations: expect.arrayContaining([
        expect.objectContaining({ id: "pricing:discount-discipline", evidence: expect.any(Array) }),
      ]),
    });
  });

  it("executes through the public executePricingIntelligence API", async () => {
    const snapshot = createMockPricingIntelligenceSnapshot();
    const factsBuilder = createPricingIntelligenceFactsBuilder({
      async getPricingIntelligenceSnapshot() {
        return snapshot;
      },
    });
    const facts = await factsBuilder.build({ storeId: "store-1", agentId: "pricing_intelligence" });

    const provider = createMockAIProvider("mock-provider", {
      generateStructured: (async () => ({
        data: buildValidPricingIntelligenceDraft(facts),
        model: "mock-model",
        provider: "mock-provider",
        usage: { promptTokens: 20, completionTokens: 40, totalTokens: 60 },
        latencyMs: 12,
        finishReason: "stop",
        validationStatus: "valid" as const,
      })) as NonNullable<import("../helpers/mock-provider").MockProviderHandlers["generateStructured"]>,
    });

    registerAgentDefinition(
      createPricingIntelligenceAgentDefinition({
        async getPricingIntelligenceSnapshot() {
          return snapshot;
        },
      }) as RegisteredAgentDefinition,
    );

    const persistence = createInMemoryAIPersistence();
    const { orchestrator } = createTestOrchestrator(provider, persistence);

    const result = await executePricingIntelligence({
      storeId: "store-1",
      orchestrator,
      persistence,
      skipLifecycle: true,
      factsSource: {
        async getPricingIntelligenceSnapshot() {
          return snapshot;
        },
      },
    });

    expect(result.status).toBe("succeeded");
    expect(result.result?.pricingHealthScore).toBe(facts.pricingHealthScore);
  });
});
