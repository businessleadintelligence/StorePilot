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
import { createProductIntelligenceAgentDefinition } from "../../agents/product-intelligence.agent";
import { createProductFactsBuilder } from "../../facts/product-facts";
import { productIntelligenceSchema } from "../../schemas/product-intelligence";
import {
  buildFactsWithHealthScore,
  buildValidProductIntelligenceOutput,
  createMockProductSnapshot,
} from "./helpers";
import { executeProductIntelligence } from "../../../services/product-intelligence.server";
import type { RegisteredAgentDefinition } from "../../agents/agent-definition";

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

describe("Product Intelligence agent registration", () => {
  it("registers product_intelligence in the agent registry", () => {
    const definition = getAgentDefinition("product_intelligence");

    expect(definition.id).toBe("product_intelligence");
    expect(definition.promptId).toBe("product-intelligence");
    expect(definition.schema).toBe(productIntelligenceSchema);
    expect(listRegisteredAgents().some((agent) => agent.id === "product_intelligence")).toBe(true);
  });
});

describe("Product Intelligence prompt builder", () => {
  it("loads reasoning-only prompt instructions", async () => {
    const loader = createFilePromptLoader({
      promptsDirectory: join(process.cwd(), "app", "ai", "prompts"),
    });
    const prompt = await loader.load("product-intelligence");

    expect(prompt.metadata.expectedSchema).toBe("product-intelligence");
    expect(prompt.metadata.version).toBe("2.0.0");
    expect(prompt.body).toContain("Never calculate velocity");
    expect(prompt.body).not.toMatch(/\bif\b.*\bthen\b/i);
  });

  it("embeds facts and memory context in the user message", async () => {
    const loader = createFilePromptLoader({
      promptsDirectory: join(process.cwd(), "app", "ai", "prompts"),
    });
    const prompt = await loader.load("product-intelligence");
    const facts = buildFactsWithHealthScore();
    const definition = createProductIntelligenceAgentDefinition({
      async getProductSnapshot() {
        return createMockProductSnapshot();
      },
    });

    const built = await definition.promptBuilder.build({
      prompt,
      facts,
      memoryContext: {
        dismissals: [{ recommendationStableId: "inventory-clearance" }],
      },
    });

    expect(built.expectedSchema).toBe("product-intelligence");
    expect(built.userMessage).toContain("Blue Hoodie");
    expect(built.userMessage).toContain("healthScore");
    expect(built.userMessage).toContain("dismissals");
  });
});

describe("Product Intelligence orchestrator integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("executes through the platform pipeline with structured JSON output", async () => {
    const snapshot = createMockProductSnapshot();
    const factsBuilder = createProductFactsBuilder({
      async getProductSnapshot() {
        return snapshot;
      },
    });
    const facts = await factsBuilder.build({
      storeId: "store-1",
      productId: snapshot.productId,
    });

    const provider = createMockAIProvider("mock-provider", {
      generateStructured: (async () => ({
        data: buildValidProductIntelligenceOutput(facts),
        model: "mock-model",
        provider: "mock-provider",
        usage: { promptTokens: 20, completionTokens: 40, totalTokens: 60 },
        latencyMs: 12,
        finishReason: "stop",
        validationStatus: "valid" as const,
      })) as NonNullable<import("../helpers/mock-provider").MockProviderHandlers["generateStructured"]>,
    });

    registerAgentDefinition(
      createProductIntelligenceAgentDefinition({
        async getProductSnapshot() {
          return snapshot;
        },
      }) as RegisteredAgentDefinition,
    );

    const persistence = createInMemoryAIPersistence();
    const { orchestrator, telemetry } = createTestOrchestrator(provider, persistence);

    const result = await orchestrator.execute({
      agent: "product_intelligence",
      storeId: "store-1",
      context: {
        subjectKey: "product:product-1",
        productId: snapshot.productId,
      },
    });

    expect(result.status).toBe("succeeded");
    expect(result.result).toMatchObject({
      summary: expect.any(String),
      healthScore: facts.healthScore,
      healthExplanation: expect.objectContaining({
        score: facts.healthScore,
        drivers: expect.any(Array),
      }),
      recommendationGroups: expect.any(Object),
      recommendations: expect.arrayContaining([
        expect.objectContaining({ id: "inventory-replenishment-plan", evidence: expect.any(Array) }),
      ]),
    });
    expect(result.recommendations).toBeGreaterThan(0);
    expect(result.telemetry.promptVersion).toBe("2.0.0");
    expect(result.telemetry.totalTokens).toBe(60);
    expect(telemetry.write).toHaveBeenCalled();
  });

  it("returns cached results when facts, prompt, and schema are unchanged", async () => {
    const snapshot = createMockProductSnapshot();
    const factsBuilder = createProductFactsBuilder({
      async getProductSnapshot() {
        return snapshot;
      },
    });
    const facts = await factsBuilder.build({
      storeId: "store-1",
      productId: snapshot.productId,
    });

    registerAgentDefinition(
      createProductIntelligenceAgentDefinition({
        async getProductSnapshot() {
          return snapshot;
        },
      }) as RegisteredAgentDefinition,
    );

    const provider = createMockAIProvider("mock-provider", {
      generateStructured: (async () => ({
        data: buildValidProductIntelligenceOutput(facts),
        model: "mock-model",
        provider: "mock-provider",
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        latencyMs: 5,
        finishReason: "stop",
        validationStatus: "valid" as const,
      })) as NonNullable<import("../helpers/mock-provider").MockProviderHandlers["generateStructured"]>,
    });

    const generateStructured = vi.spyOn(provider, "generateStructured");
    const persistence = createInMemoryAIPersistence();
    const { orchestrator } = createTestOrchestrator(provider, persistence);

    const context = {
      subjectKey: "product:product-1",
      productId: snapshot.productId,
    };

    const first = await orchestrator.execute({
      agent: "product_intelligence",
      storeId: "store-1",
      context,
    });
    const second = await orchestrator.execute({
      agent: "product_intelligence",
      storeId: "store-1",
      context,
    });

    expect(first.status).toBe("succeeded");
    expect(second.status).toBe("cached");
    expect(second.fromCache).toBe(true);
    expect(generateStructured).toHaveBeenCalledTimes(1);
  });

  it("retries once on malformed JSON and succeeds on the second attempt", async () => {
    const snapshot = createMockProductSnapshot();
    registerAgentDefinition(
      createProductIntelligenceAgentDefinition({
        async getProductSnapshot() {
          return snapshot;
        },
      }) as RegisteredAgentDefinition,
    );

    let attempts = 0;
    const provider = createMockAIProvider("mock-provider", {
      generateStructured: (async () => {
        attempts += 1;
        const facts = buildFactsWithHealthScore(snapshot);

        if (attempts === 1) {
          return {
            data: {
              ...buildValidProductIntelligenceOutput(facts),
              summary: "",
            },
            model: "mock-model",
            provider: "mock-provider",
            usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
            latencyMs: 1,
            finishReason: "stop",
            validationStatus: "valid" as const,
          };
        }

        return {
          data: buildValidProductIntelligenceOutput(facts),
          model: "mock-model",
          provider: "mock-provider",
          usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
          latencyMs: 1,
          finishReason: "stop",
          validationStatus: "valid" as const,
        };
      }) as NonNullable<import("../helpers/mock-provider").MockProviderHandlers["generateStructured"]>,
    });

    const { orchestrator } = createTestOrchestrator(provider);
    const result = await orchestrator.execute({
      agent: "product_intelligence",
      storeId: "store-1",
      context: {
        subjectKey: "product:product-1",
        productId: snapshot.productId,
      },
    });

    expect(attempts).toBe(2);
    expect(result.status).toBe("succeeded");
    expect(result.telemetry.retryCount).toBe(1);
    expect(result.telemetry.validationStatus).toBe("retried");
  });

  it("fails when business validation remains invalid after retry", async () => {
    const snapshot = createMockProductSnapshot();
    registerAgentDefinition(
      createProductIntelligenceAgentDefinition({
        async getProductSnapshot() {
          return snapshot;
        },
      }) as RegisteredAgentDefinition,
    );

    const provider = createMockAIProvider("mock-provider", {
      generateStructured: (async () => {
        const facts = buildFactsWithHealthScore(snapshot);
        const output = buildValidProductIntelligenceOutput(facts);
        output.healthScore = facts.healthScore + 5;

        return {
          data: output,
          model: "mock-model",
          provider: "mock-provider",
          usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
          latencyMs: 1,
          finishReason: "stop",
          validationStatus: "valid" as const,
        };
      }) as NonNullable<import("../helpers/mock-provider").MockProviderHandlers["generateStructured"]>,
    });

    const { orchestrator } = createTestOrchestrator(provider);
    const result = await orchestrator.execute({
      agent: "product_intelligence",
      storeId: "store-1",
      context: {
        subjectKey: "product:product-1",
        productId: snapshot.productId,
      },
    });

    expect(result.status).toBe("failed");
    expect(result.errorCode).toBe("business_rule_validation_failed");
  });
});

describe("Product Intelligence public API", () => {
  it("preloads recommendation memory through the execution wrapper", async () => {
    const snapshot = createMockProductSnapshot();
    registerAgentDefinition(
      createProductIntelligenceAgentDefinition({
        async getProductSnapshot() {
          return snapshot;
        },
      }) as RegisteredAgentDefinition,
    );

    const persistence = createInMemoryAIPersistence();
    await persistence.recommendations.upsertMany([
      {
        storeId: "store-1",
        agentId: "product_intelligence",
        runId: "run-existing",
        subjectKey: "product:product-1",
        stableId: "stable-dismissed",
        title: "Old clearance",
        summary: "Previously dismissed",
        category: "Inventory",
        priority: 1,
        confidence: 0.9,
        payloadJson: { id: "inventory-replenishment-plan" },
        status: "dismissed",
      },
    ]);

    const provider = createMockAIProvider("mock-provider", {
      generateStructured: (async () => {
        const facts = buildFactsWithHealthScore(snapshot);
        return {
          data: buildValidProductIntelligenceOutput(facts),
          model: "mock-model",
          provider: "mock-provider",
          usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
          latencyMs: 3,
          finishReason: "stop",
          validationStatus: "valid" as const,
        };
      }) as NonNullable<import("../helpers/mock-provider").MockProviderHandlers["generateStructured"]>,
    });

    const cache = new ResultCacheService({
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
    });

    const { orchestrator } = createTestOrchestrator(provider, persistence);

    const result = await executeProductIntelligence({
      storeId: "store-1",
      productId: snapshot.productId,
      persistence,
      orchestrator,
      skipLifecycle: true,
      orchestratorDeps: {
        provider,
        telemetry: { write: vi.fn(async () => undefined) },
        cache,
      },
    });

    expect(result.status).toBe("succeeded");
    const enrichedRecommendation = result.result?.recommendations.find(
      (entry) => entry.id === "inventory-replenishment-plan",
    );
    const stored = await persistence.recommendations.listBySubject({
      storeId: "store-1",
      subjectKey: "product:product-1",
    });
    const rerun = stored.find(
      (entry) =>
        entry.runId === result.runId &&
        entry.payloadJson.id === "inventory-replenishment-plan",
    );
    expect(enrichedRecommendation?.priority).toBeDefined();
    expect(rerun?.priority).toBe(
      Math.min(5, (enrichedRecommendation?.priority ?? 1) + 1),
    );
  });
});
