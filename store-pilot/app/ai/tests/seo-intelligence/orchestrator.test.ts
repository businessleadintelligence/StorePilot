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
import { createSeoIntelligenceAgentDefinition } from "../../agents/seo-intelligence.agent";
import { seoIntelligenceSchema } from "../../schemas/seo-intelligence";
import {
  buildValidSeoIntelligenceDraft,
  createMockSeoIntelligenceSnapshot,
} from "./helpers";
import { executeSeoIntelligence } from "../../../services/seo-intelligence.server";
import type { RegisteredAgentDefinition } from "../../agents/agent-definition";
import { createSeoIntelligenceFactsBuilder } from "../../facts/seo-intelligence-facts";

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

describe("SEO Intelligence agent registration", () => {
  it("registers seo_audit in the agent registry", () => {
    const definition = getAgentDefinition("seo_audit");

    expect(definition.id).toBe("seo_audit");
    expect(definition.promptId).toBe("seo-intelligence");
    expect(definition.schema).toBe(seoIntelligenceSchema);
    expect(listRegisteredAgents().some((agent) => agent.id === "seo_audit")).toBe(true);
  });

  it("loads reasoning-only SEO intelligence prompt instructions", async () => {
    const loader = createFilePromptLoader({
      promptsDirectory: join(process.cwd(), "app", "ai", "prompts"),
    });
    const prompt = await loader.load("seo-intelligence");

    expect(prompt.metadata.expectedSchema).toBe("seo-intelligence");
    expect(prompt.body).toContain("Never calculate SEO scores");
    expect(prompt.body).toContain("Return JSON only");
  });
});

describe("SEO Intelligence orchestrator integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("executes through the platform pipeline with structured JSON output", async () => {
    const snapshot = createMockSeoIntelligenceSnapshot();
    const factsBuilder = createSeoIntelligenceFactsBuilder({
      async getSeoIntelligenceSnapshot() {
        return snapshot;
      },
    });
    const facts = await factsBuilder.build({ storeId: "store-1", agentId: "seo_audit" });

    const provider = createMockAIProvider("mock-provider", {
      generateStructured: (async () => ({
        data: buildValidSeoIntelligenceDraft(facts),
        model: "mock-model",
        provider: "mock-provider",
        usage: { promptTokens: 20, completionTokens: 40, totalTokens: 60 },
        latencyMs: 12,
        finishReason: "stop",
        validationStatus: "valid" as const,
      })) as NonNullable<import("../helpers/mock-provider").MockProviderHandlers["generateStructured"]>,
    });

    registerAgentDefinition(
      createSeoIntelligenceAgentDefinition({
        async getSeoIntelligenceSnapshot() {
          return snapshot;
        },
      }) as RegisteredAgentDefinition,
    );

    const persistence = createInMemoryAIPersistence();
    const { orchestrator } = createTestOrchestrator(provider, persistence);

    const result = await orchestrator.execute({
      agent: "seo_audit",
      storeId: "store-1",
      context: {
        subjectKey: "seo-intelligence:store-1",
      },
    });

    expect(result.status).toBe("succeeded");
    expect(result.result).toMatchObject({
      summary: expect.any(String),
      seoHealthScore: facts.seoHealthScore,
      healthExplanation: expect.objectContaining({
        score: facts.seoHealthScore,
      }),
      recommendations: expect.arrayContaining([
        expect.objectContaining({ id: "seo:metadata-titles", evidence: expect.any(Array) }),
      ]),
    });
  });

  it("executes through the public executeSeoIntelligence API", async () => {
    const snapshot = createMockSeoIntelligenceSnapshot();
    const factsBuilder = createSeoIntelligenceFactsBuilder({
      async getSeoIntelligenceSnapshot() {
        return snapshot;
      },
    });
    const facts = await factsBuilder.build({ storeId: "store-1", agentId: "seo_audit" });

    const provider = createMockAIProvider("mock-provider", {
      generateStructured: (async () => ({
        data: buildValidSeoIntelligenceDraft(facts),
        model: "mock-model",
        provider: "mock-provider",
        usage: { promptTokens: 20, completionTokens: 40, totalTokens: 60 },
        latencyMs: 12,
        finishReason: "stop",
        validationStatus: "valid" as const,
      })) as NonNullable<import("../helpers/mock-provider").MockProviderHandlers["generateStructured"]>,
    });

    registerAgentDefinition(
      createSeoIntelligenceAgentDefinition({
        async getSeoIntelligenceSnapshot() {
          return snapshot;
        },
      }) as RegisteredAgentDefinition,
    );

    const persistence = createInMemoryAIPersistence();
    const { orchestrator } = createTestOrchestrator(provider, persistence);

    const result = await executeSeoIntelligence({
      storeId: "store-1",
      orchestrator,
      persistence,
      skipLifecycle: true,
      factsSource: {
        async getSeoIntelligenceSnapshot() {
          return snapshot;
        },
      },
    });

    expect(result.status).toBe("succeeded");
    expect(result.result?.seoHealthScore).toBe(facts.seoHealthScore);
  });
});
