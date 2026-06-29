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
import { createInventoryIntelligenceAgentDefinition } from "../../agents/inventory-intelligence.agent";
import { inventoryIntelligenceSchema } from "../../schemas/inventory-intelligence";
import {
  buildValidInventoryIntelligenceDraft,
  createMockInventoryProduct,
  createMockInventorySnapshot,
} from "./helpers";
import { executeInventoryIntelligence } from "../../../services/inventory-intelligence.server";
import type { RegisteredAgentDefinition } from "../../agents/agent-definition";
import { createInventoryFactsBuilder } from "../../facts/inventory-facts";

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

describe("Inventory Intelligence agent registration", () => {
  it("registers inventory_intelligence in the agent registry", () => {
    const definition = getAgentDefinition("inventory_intelligence");

    expect(definition.id).toBe("inventory_intelligence");
    expect(definition.promptId).toBe("inventory-intelligence");
    expect(definition.schema).toBe(inventoryIntelligenceSchema);
    expect(listRegisteredAgents().some((agent) => agent.id === "inventory_intelligence")).toBe(true);
  });

  it("loads reasoning-only inventory prompt instructions", async () => {
    const loader = createFilePromptLoader({
      promptsDirectory: join(process.cwd(), "app", "ai", "prompts"),
    });
    const prompt = await loader.load("inventory-intelligence");

    expect(prompt.metadata.expectedSchema).toBe("inventory-intelligence");
    expect(prompt.body).toContain("Do not calculate days remaining");
    expect(prompt.body).toContain("Never calculate revenue");
  });
});

describe("Inventory Intelligence orchestrator integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("executes through the platform pipeline with structured JSON output", async () => {
    const snapshot = createMockInventoryProduct();
    const factsBuilder = createInventoryFactsBuilder({
      async getStoreInventorySnapshot() {
        return createMockInventorySnapshot([snapshot]);
      },
    });
    const facts = await factsBuilder.build({ storeId: "store-1" });

    const provider = createMockAIProvider("mock-provider", {
      generateStructured: (async () => ({
        data: buildValidInventoryIntelligenceDraft(facts),
        model: "mock-model",
        provider: "mock-provider",
        usage: { promptTokens: 20, completionTokens: 40, totalTokens: 60 },
        latencyMs: 12,
        finishReason: "stop",
        validationStatus: "valid" as const,
      })) as NonNullable<import("../helpers/mock-provider").MockProviderHandlers["generateStructured"]>,
    });

    registerAgentDefinition(
      createInventoryIntelligenceAgentDefinition({
        async getStoreInventorySnapshot() {
          return createMockInventorySnapshot([snapshot]);
        },
      }) as RegisteredAgentDefinition,
    );

    const persistence = createInMemoryAIPersistence();
    const { orchestrator } = createTestOrchestrator(provider, persistence);

    const result = await orchestrator.execute({
      agent: "inventory_intelligence",
      storeId: "store-1",
      context: {
        subjectKey: "inventory:store-1",
      },
    });

    expect(result.status).toBe("succeeded");
    expect(result.result).toMatchObject({
      summary: expect.any(String),
      inventoryHealthScore: facts.inventoryHealthScore,
      healthExplanation: expect.objectContaining({
        score: facts.inventoryHealthScore,
      }),
      recommendations: expect.arrayContaining([
        expect.objectContaining({ id: "reorder:product-1", evidence: expect.any(Array) }),
      ]),
    });
  });

  it("executes through the public executeInventoryIntelligence API", async () => {
    const snapshot = createMockInventoryProduct();
    const factsBuilder = createInventoryFactsBuilder({
      async getStoreInventorySnapshot() {
        return createMockInventorySnapshot([snapshot]);
      },
    });
    const facts = await factsBuilder.build({ storeId: "store-1" });
    const provider = createMockAIProvider("mock-provider", {
      generateStructured: (async () => ({
        data: buildValidInventoryIntelligenceDraft(facts),
        model: "mock-model",
        provider: "mock-provider",
        usage: { promptTokens: 20, completionTokens: 40, totalTokens: 60 },
        latencyMs: 12,
        finishReason: "stop",
        validationStatus: "valid" as const,
      })) as NonNullable<import("../helpers/mock-provider").MockProviderHandlers["generateStructured"]>,
    });

    registerAgentDefinition(
      createInventoryIntelligenceAgentDefinition({
        async getStoreInventorySnapshot() {
          return createMockInventorySnapshot([snapshot]);
        },
      }) as RegisteredAgentDefinition,
    );

    const persistence = createInMemoryAIPersistence();
    const { orchestrator } = createTestOrchestrator(provider, persistence);

    const result = await executeInventoryIntelligence({
      storeId: "store-1",
      orchestrator,
      persistence,
      factsSource: {
        async getStoreInventorySnapshot() {
          return createMockInventorySnapshot([snapshot]);
        },
      },
      skipLifecycle: true,
    });

    expect(result.status).toBe("succeeded");
    expect(result.result?.inventoryHealthScore).toBe(facts.inventoryHealthScore);
  });
});
