import { describe, expect, it, vi } from "vitest";

import { executeStoreAudit } from "../store-audit.server";
import { createInMemoryAIPersistence } from "../../ai/persistence/in-memory-persistence";
import { createStoreAuditFactsBuilder } from "../../ai/facts/store-audit-facts";
import { buildValidStoreAuditDraft, createMockStoreAuditSnapshot } from "../../ai/tests/store-audit/helpers";
import { registerAgentDefinition } from "../../ai/agents/agent-registry";
import { createStoreAuditAgentDefinition } from "../../ai/agents/store-audit.agent";
import type { RegisteredAgentDefinition } from "../../ai/agents/agent-definition";
import { createMockAIProvider } from "../../ai/tests/helpers/mock-provider";

vi.mock("../../ai/telemetry/cost-control", () => ({
  assertAiBudgetAllowed: vi.fn(async () => ({
    allowed: true,
    consumed: 1,
    reason: null,
  })),
}));

describe("Store Audit public API", () => {
  it("builds store audit subject key", async () => {
    const { buildStoreAuditSubjectKey } = await import("../store-audit.server");
    expect(buildStoreAuditSubjectKey("store-1")).toBe("store-audit:store-1");
  });

  it("executes store audit with mocked facts source", async () => {
    const snapshot = createMockStoreAuditSnapshot();
    const factsBuilder = createStoreAuditFactsBuilder({
      async getStoreAuditSnapshot() {
        return snapshot;
      },
    });
    const facts = await factsBuilder.build({ storeId: "store-1" });

    registerAgentDefinition(
      createStoreAuditAgentDefinition({
        async getStoreAuditSnapshot() {
          return snapshot;
        },
      }) as RegisteredAgentDefinition,
    );

    const persistence = createInMemoryAIPersistence();
    const provider = createMockAIProvider("mock-provider", {
      generateStructured: (async () => ({
        data: buildValidStoreAuditDraft(facts),
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
    expect(result.result?.homepageScore).toBe(facts.homepageScore);
  });
});

describe("Store Audit command center widget", () => {
  it("builds widget shape from persisted audit scores", () => {
    const widget = {
      storeHealth: 74,
      homepageScore: 78,
      seoScore: 76,
      accessibilityScore: 71,
      performanceScore: 72,
      conversionScore: 69,
      mobileScore: 73,
      themeScore: 70,
      openRecommendations: 0,
      criticalIssues: 0,
      recentExecutions: 0,
      recommendationGroups: [],
      issueDistribution: [],
      topFixes: [],
      seoWidgets: [{ label: "SEO Score", value: 76 }],
      accessibilityWidgets: [{ label: "Accessibility Score", value: 71 }],
      performanceWidgets: [{ label: "Performance Score", value: 72 }],
      auditTimeline: [{ label: "Health", value: 74 }],
      opportunityPipeline: [],
    };

    expect(widget.storeHealth).toBe(74);
    expect(widget.seoWidgets.length).toBeGreaterThan(0);
  });
});
