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
import { createBundleDiscoveryAgentDefinition } from "../../agents/bundle-discovery.agent";
import { bundleIntelligenceSchema } from "../../schemas/bundle-intelligence";
import {
  buildValidBundleDiscoveryDraft,
  createMockBundleSnapshot,
} from "./helpers";
import { executeBundleDiscovery } from "../../../services/bundle-intelligence.server";
import type { RegisteredAgentDefinition } from "../../agents/agent-definition";
import { createBundleFactsBuilder } from "../../facts/bundle-facts";

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

describe("Bundle Discovery agent registration", () => {
  it("registers bundle_discovery in the agent registry", () => {
    const definition = getAgentDefinition("bundle_discovery");

    expect(definition.id).toBe("bundle_discovery");
    expect(definition.promptId).toBe("bundle-discovery");
    expect(definition.schema).toBe(bundleIntelligenceSchema);
    expect(listRegisteredAgents().some((agent) => agent.id === "bundle_discovery")).toBe(true);
  });

  it("loads reasoning-only bundle prompt instructions", async () => {
    const loader = createFilePromptLoader({
      promptsDirectory: join(process.cwd(), "app", "ai", "prompts"),
    });
    const prompt = await loader.load("bundle-discovery");

    expect(prompt.metadata.expectedSchema).toBe("bundle-intelligence");
    expect(prompt.body).toContain("Never calculate attach rate");
    expect(prompt.body).toContain("Return JSON only");
  });
});

describe("Bundle Discovery orchestrator integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("executes through the platform pipeline with structured JSON output", async () => {
    const snapshot = createMockBundleSnapshot();
    const factsBuilder = createBundleFactsBuilder({
      async getStoreBundleSnapshot() {
        return snapshot;
      },
    });
    const facts = await factsBuilder.build({ storeId: "store-1" });

    const provider = createMockAIProvider("mock-provider", {
      generateStructured: (async () => ({
        data: buildValidBundleDiscoveryDraft(facts),
        model: "mock-model",
        provider: "mock-provider",
        usage: { promptTokens: 20, completionTokens: 40, totalTokens: 60 },
        latencyMs: 12,
        finishReason: "stop",
        validationStatus: "valid" as const,
      })) as NonNullable<import("../helpers/mock-provider").MockProviderHandlers["generateStructured"]>,
    });

    registerAgentDefinition(
      createBundleDiscoveryAgentDefinition({
        async getStoreBundleSnapshot() {
          return snapshot;
        },
      }) as RegisteredAgentDefinition,
    );

    const persistence = createInMemoryAIPersistence();
    const { orchestrator } = createTestOrchestrator(provider, persistence);

    const result = await orchestrator.execute({
      agent: "bundle_discovery",
      storeId: "store-1",
      context: {
        subjectKey: "bundle:store-1",
      },
    });

    expect(result.status).toBe("succeeded");
    expect(result.result).toMatchObject({
      summary: expect.any(String),
      bundleHealthScore: facts.bundleHealthScore,
      healthExplanation: expect.objectContaining({
        score: facts.bundleHealthScore,
      }),
      recommendations: expect.arrayContaining([
        expect.objectContaining({ id: facts.bundleCandidates[0]?.id, evidence: expect.any(Array) }),
      ]),
    });
  });

  it("executes through the public executeBundleDiscovery API", async () => {
    const snapshot = createMockBundleSnapshot();
    const factsBuilder = createBundleFactsBuilder({
      async getStoreBundleSnapshot() {
        return snapshot;
      },
    });
    const facts = await factsBuilder.build({ storeId: "store-1" });
    const provider = createMockAIProvider("mock-provider", {
      generateStructured: (async () => ({
        data: buildValidBundleDiscoveryDraft(facts),
        model: "mock-model",
        provider: "mock-provider",
        usage: { promptTokens: 20, completionTokens: 40, totalTokens: 60 },
        latencyMs: 12,
        finishReason: "stop",
        validationStatus: "valid" as const,
      })) as NonNullable<import("../helpers/mock-provider").MockProviderHandlers["generateStructured"]>,
    });

    registerAgentDefinition(
      createBundleDiscoveryAgentDefinition({
        async getStoreBundleSnapshot() {
          return snapshot;
        },
      }) as RegisteredAgentDefinition,
    );

    const persistence = createInMemoryAIPersistence();
    const { orchestrator } = createTestOrchestrator(provider, persistence);

    const result = await executeBundleDiscovery({
      storeId: "store-1",
      orchestrator,
      persistence,
      factsSource: {
        async getStoreBundleSnapshot() {
          return snapshot;
        },
      },
      skipLifecycle: true,
    });

    expect(result.status).toBe("succeeded");
    expect(result.result?.bundleHealthScore).toBe(facts.bundleHealthScore);
  });
});
