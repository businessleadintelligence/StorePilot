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
import { createExecutiveCooAgentDefinition } from "../../agents/executive-coo.agent";
import { executiveCooSchema } from "../../schemas/executive-coo";
import {
  buildValidExecutiveCooDraft,
  createMockExecutiveCooSnapshot,
} from "./helpers";
import { executeExecutiveCoo } from "../../../services/executive-coo.server";
import type { RegisteredAgentDefinition } from "../../agents/agent-definition";
import { createExecutiveCooFactsBuilder } from "../../facts/executive-coo-facts";

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

describe("Executive COO agent registration", () => {
  it("registers executive_coo in the agent registry", () => {
    const definition = getAgentDefinition("executive_coo");

    expect(definition.id).toBe("executive_coo");
    expect(definition.promptId).toBe("executive-coo");
    expect(definition.schema).toBe(executiveCooSchema);
    expect(listRegisteredAgents().some((agent) => agent.id === "executive_coo")).toBe(true);
  });

  it("loads reasoning-only executive COO prompt instructions", async () => {
    const loader = createFilePromptLoader({
      promptsDirectory: join(process.cwd(), "app", "ai", "prompts"),
    });
    const prompt = await loader.load("executive-coo");

    expect(prompt.metadata.expectedSchema).toBe("executive-coo");
    expect(prompt.body).toContain("Never calculate business health scores");
    expect(prompt.body).toContain("Return JSON only");
  });
});

describe("Executive COO orchestrator integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("executes through the platform pipeline with structured JSON output", async () => {
    const snapshot = createMockExecutiveCooSnapshot();
    const factsBuilder = createExecutiveCooFactsBuilder({
      async getExecutiveCooSnapshot() {
        return snapshot;
      },
    });
    const facts = await factsBuilder.build({ storeId: "store-1", agentId: "executive_coo" });

    const provider = createMockAIProvider("mock-provider", {
      generateStructured: (async () => ({
        data: buildValidExecutiveCooDraft(facts),
        model: "mock-model",
        provider: "mock-provider",
        usage: { promptTokens: 20, completionTokens: 40, totalTokens: 60 },
        latencyMs: 12,
        finishReason: "stop",
        validationStatus: "valid" as const,
      })) as NonNullable<import("../helpers/mock-provider").MockProviderHandlers["generateStructured"]>,
    });

    registerAgentDefinition(
      createExecutiveCooAgentDefinition({
        async getExecutiveCooSnapshot() {
          return snapshot;
        },
      }) as RegisteredAgentDefinition,
    );

    const persistence = createInMemoryAIPersistence();
    const { orchestrator } = createTestOrchestrator(provider, persistence);

    const result = await orchestrator.execute({
      agent: "executive_coo",
      storeId: "store-1",
      context: {
        subjectKey: "executive-coo:store-1",
      },
    });

    expect(result.status).toBe("succeeded");
    expect(result.result).toMatchObject({
      summary: expect.any(String),
      operationsHealthScore: facts.operationsHealthScore,
      healthExplanation: expect.objectContaining({
        score: facts.operationsHealthScore,
      }),
      topPriorities: expect.arrayContaining([
        expect.objectContaining({ id: "executive-coo:inventory-replenishment", evidenceKeys: expect.any(Array) }),
      ]),
    });
  });

  it("executes through the public executeExecutiveCoo API", async () => {
    const snapshot = createMockExecutiveCooSnapshot();
    const factsBuilder = createExecutiveCooFactsBuilder({
      async getExecutiveCooSnapshot() {
        return snapshot;
      },
    });
    const facts = await factsBuilder.build({ storeId: "store-1", agentId: "executive_coo" });

    const provider = createMockAIProvider("mock-provider", {
      generateStructured: (async () => ({
        data: buildValidExecutiveCooDraft(facts),
        model: "mock-model",
        provider: "mock-provider",
        usage: { promptTokens: 20, completionTokens: 40, totalTokens: 60 },
        latencyMs: 12,
        finishReason: "stop",
        validationStatus: "valid" as const,
      })) as NonNullable<import("../helpers/mock-provider").MockProviderHandlers["generateStructured"]>,
    });

    registerAgentDefinition(
      createExecutiveCooAgentDefinition({
        async getExecutiveCooSnapshot() {
          return snapshot;
        },
      }) as RegisteredAgentDefinition,
    );

    const persistence = createInMemoryAIPersistence();
    const { orchestrator } = createTestOrchestrator(provider, persistence);

    const result = await executeExecutiveCoo({
      storeId: "store-1",
      orchestrator,
      persistence,
      skipLifecycle: true,
      factsSource: {
        async getExecutiveCooSnapshot() {
          return snapshot;
        },
      },
    });

    expect(result.status).toBe("succeeded");
    expect(result.result?.operationsHealthScore).toBe(facts.operationsHealthScore);
  });
});
