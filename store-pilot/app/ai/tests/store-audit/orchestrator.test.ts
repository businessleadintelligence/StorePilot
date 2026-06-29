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
import { createStoreAuditAgentDefinition } from "../../agents/store-audit.agent";
import { storeAuditIntelligenceSchema } from "../../schemas/store-audit-intelligence";
import {
  buildValidStoreAuditDraft,
  createMockStoreAuditSnapshot,
} from "./helpers";
import { executeStoreAudit } from "../../../services/store-audit.server";
import type { RegisteredAgentDefinition } from "../../agents/agent-definition";
import { createStoreAuditFactsBuilder } from "../../facts/store-audit-facts";

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

describe("Store Audit agent registration", () => {
  it("registers store_audit in the agent registry", () => {
    const definition = getAgentDefinition("store_audit");

    expect(definition.id).toBe("store_audit");
    expect(definition.promptId).toBe("store-audit");
    expect(definition.schema).toBe(storeAuditIntelligenceSchema);
    expect(listRegisteredAgents().some((agent) => agent.id === "store_audit")).toBe(true);
  });

  it("loads reasoning-only store audit prompt instructions", async () => {
    const loader = createFilePromptLoader({
      promptsDirectory: join(process.cwd(), "app", "ai", "prompts"),
    });
    const prompt = await loader.load("store-audit");

    expect(prompt.metadata.expectedSchema).toBe("store-audit-intelligence");
    expect(prompt.body).toContain("Never calculate scores");
    expect(prompt.body).toContain("Return JSON only");
  });
});

describe("Store Audit orchestrator integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("executes through the platform pipeline with structured JSON output", async () => {
    const snapshot = createMockStoreAuditSnapshot();
    const factsBuilder = createStoreAuditFactsBuilder({
      async getStoreAuditSnapshot() {
        return snapshot;
      },
    });
    const facts = await factsBuilder.build({ storeId: "store-1" });

    const provider = createMockAIProvider("mock-provider", {
      generateStructured: (async () => ({
        data: buildValidStoreAuditDraft(facts),
        model: "mock-model",
        provider: "mock-provider",
        usage: { promptTokens: 20, completionTokens: 40, totalTokens: 60 },
        latencyMs: 12,
        finishReason: "stop",
        validationStatus: "valid" as const,
      })) as NonNullable<import("../helpers/mock-provider").MockProviderHandlers["generateStructured"]>,
    });

    registerAgentDefinition(
      createStoreAuditAgentDefinition({
        async getStoreAuditSnapshot() {
          return snapshot;
        },
      }) as RegisteredAgentDefinition,
    );

    const persistence = createInMemoryAIPersistence();
    const { orchestrator } = createTestOrchestrator(provider, persistence);

    const result = await orchestrator.execute({
      agent: "store_audit",
      storeId: "store-1",
      context: {
        subjectKey: "store-audit:store-1",
      },
    });

    expect(result.status).toBe("succeeded");
    expect(result.result).toMatchObject({
      summary: expect.any(String),
      storeHealthScore: facts.storeHealthScore,
      healthExplanation: expect.objectContaining({
        score: facts.storeHealthScore,
      }),
      recommendations: expect.arrayContaining([
        expect.objectContaining({ id: "audit:homepage-social-proof", evidence: expect.any(Array) }),
      ]),
    });
  });

  it("executes through the public executeStoreAudit API", async () => {
    const snapshot = createMockStoreAuditSnapshot();
    const factsBuilder = createStoreAuditFactsBuilder({
      async getStoreAuditSnapshot() {
        return snapshot;
      },
    });
    const facts = await factsBuilder.build({ storeId: "store-1" });

    const provider = createMockAIProvider("mock-provider", {
      generateStructured: (async () => ({
        data: buildValidStoreAuditDraft(facts),
        model: "mock-model",
        provider: "mock-provider",
        usage: { promptTokens: 20, completionTokens: 40, totalTokens: 60 },
        latencyMs: 12,
        finishReason: "stop",
        validationStatus: "valid" as const,
      })) as NonNullable<import("../helpers/mock-provider").MockProviderHandlers["generateStructured"]>,
    });

    registerAgentDefinition(
      createStoreAuditAgentDefinition({
        async getStoreAuditSnapshot() {
          return snapshot;
        },
      }) as RegisteredAgentDefinition,
    );

    const persistence = createInMemoryAIPersistence();
    const { orchestrator } = createTestOrchestrator(provider, persistence);

    const result = await executeStoreAudit({
      storeId: "store-1",
      orchestrator,
      persistence,
      factsSource: {
        async getStoreAuditSnapshot() {
          return snapshot;
        },
      },
    });

    expect(result.status).toBe("succeeded");
    expect(result.result?.storeHealthScore).toBe(facts.storeHealthScore);
  });
});
