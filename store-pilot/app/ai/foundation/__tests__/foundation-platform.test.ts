import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { AIPlatformError } from "../../core/ai-errors";
import { FoundationCacheService } from "../cache/cache-service";
import { InMemoryFoundationCache } from "../cache/semantic-cache";
import { CostManager, InMemoryCostLedger } from "../cost/cost-manager";
import { createFoundationPipeline } from "../pipeline";
import {
  InMemoryPromptRegistry,
  renderPromptTemplate,
  resolvePromptDefinition,
} from "../prompt-registry/registry";
import { ProviderRouter } from "../provider-router/router";
import {
  applyBudgetDowngrade,
  resolveModelRoute,
} from "../model-router/routing-policy";
import {
  resolveTaskTier,
  resolveTierBinding,
  TASK_TIER_MAP,
} from "../model-router/model-config";
import {
  createStandardValidationRules,
  rejectUnknownFields,
  runResponseValidation,
  validateEnumField,
} from "../response-validator/validator";
import { CircuitBreaker } from "../retry/circuit-breaker";
import {
  computeRetryDelay,
  DEFAULT_RETRY_POLICY,
  executeWithRetry,
  isRetryableError,
} from "../retry/retry-engine";
import { TokenBucketRateLimiter } from "../rate-limit/rate-limiter";
import { runStructuredOutputEngine } from "../structured-output/engine";
import { attemptJsonRepair, repairJsonString } from "../structured-output/json-repair";
import { buildPromptHash, hashObject, hashString } from "../utils/hash";
import {
  sanitizeMessagesForAi,
  sanitizeTextForAi,
  sanitizeVariablesForAi,
} from "../utils/pii-sanitizer";
import { FoundationMetricsCollector } from "../metrics/metrics-collector";
import { MockFoundationProvider, createMockProviderRouter } from "./helpers/mock-provider";

const testSchema = z.object({
  label: z.string(),
  confidence: z.number().min(0).max(1).optional(),
});

function createTestPromptRegistry(): InMemoryPromptRegistry {
  const registry = new InMemoryPromptRegistry();
  registry.register({
    id: "foundation.test",
    version: "v1",
    author: "test",
    description: "Test prompt",
    body: "Analyze {{metric}} and respond in JSON.",
    inputSchema: "object",
    outputSchema: "foundation.test",
    temperature: 0.1,
    defaultTier: "nano",
    createdAt: new Date().toISOString(),
  });
  return registry;
}

describe("AI Platform Foundation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("model router", () => {
    it("maps task categories to tiers", () => {
      expect(resolveTaskTier("executive_reasoning")).toBe("reasoning");
      expect(resolveTaskTier("classification")).toBe("nano");
      expect(TASK_TIER_MAP.report_writing).toBe("standard");
    });

    it("resolves tier bindings from environment", () => {
      const route = resolveTierBinding("fast", {
        AI_TIER_FAST_PROVIDER: "anthropic",
        AI_TIER_FAST_MODEL: "claude-3-5-haiku-latest",
      });
      expect(route).toMatchObject({
        tier: "fast",
        providerId: "anthropic",
        modelId: "claude-3-5-haiku-latest",
      });
    });

    it("downgrades tiers as budget thresholds are crossed", () => {
      expect(applyBudgetDowngrade("reasoning", 50)).toBe("reasoning");
      expect(applyBudgetDowngrade("reasoning", 75)).toBe("standard");
      expect(applyBudgetDowngrade("reasoning", 90)).toBe("standard");
      expect(applyBudgetDowngrade("standard", 90)).toBe("fast");
      expect(applyBudgetDowngrade("reasoning", 96)).toBe("nano");
    });

    it("returns route metadata with downgrade flag", () => {
      const result = resolveModelRoute({
        taskCategory: "executive_reasoning",
        monthlyBudgetUsd: 100,
        monthlySpendUsd: 80,
      });
      expect(result.requestedTier).toBe("reasoning");
      expect(result.resolvedTier).toBe("standard");
      expect(result.downgraded).toBe(true);
    });
  });

  describe("provider router", () => {
    it("resolves registered providers", () => {
      const mock = new MockFoundationProvider("openai");
      const router = createMockProviderRouter(mock);
      expect(router.resolve("openai").id).toBe("openai");
    });

    it("throws when provider is not registered", () => {
      const mock = new MockFoundationProvider("openai");
      const router = createMockProviderRouter(mock);
      expect(() => router.resolve("anthropic")).toThrow(AIPlatformError);
    });

    it("reports stub providers as unhealthy", async () => {
      const router = new ProviderRouter();
      const checks = await router.healthCheckAll();
      const gemini = checks.find((entry) => entry.providerId === "gemini");
      expect(gemini?.healthy).toBe(false);
    });
  });

  describe("prompt registry", () => {
    it("renders template variables", () => {
      const rendered = renderPromptTemplate("Hello {{name}}", { name: "StorePilot" });
      expect(rendered).toBe("Hello StorePilot");
    });

    it("resolves latest version when version omitted", () => {
      const registry = createTestPromptRegistry();
      registry.register({
        id: "foundation.test",
        version: "v2",
        author: "test",
        description: "v2",
        body: "v2 body",
        inputSchema: "object",
        outputSchema: "foundation.test",
        temperature: 0.1,
        defaultTier: "nano",
        createdAt: new Date().toISOString(),
      });
      const prompt = resolvePromptDefinition({
        registry,
        promptId: "foundation.test",
      });
      expect(prompt.version).toBe("v2");
    });

    it("hashes prompt bodies deterministically", () => {
      const hash = buildPromptHash({
        promptId: "foundation.test",
        promptVersion: "v1",
        body: "body",
      });
      expect(hash).toBe(hashString("foundation.test:v1:body"));
    });
  });

  describe("structured output engine", () => {
    it("parses valid JSON payloads", () => {
      const result = runStructuredOutputEngine(
        JSON.stringify({ label: "ok", confidence: 0.8 }),
        { schema: testSchema, schemaName: "test" },
      );
      expect(result.data).toEqual({ label: "ok", confidence: 0.8 });
      expect(result.usedRepair).toBe(false);
    });

    it("extracts JSON embedded in prose", () => {
      const result = runStructuredOutputEngine(
        'Here is the result: {"label":"embedded"} end',
        { schema: testSchema, schemaName: "test" },
      );
      expect(result.data.label).toBe("embedded");
    });

    it("repairs malformed JSON", () => {
      const repaired = repairJsonString('{label:"broken",}');
      expect(repaired).toContain('"label"');
      const parsed = attemptJsonRepair('{label:"broken",}');
      expect(parsed).toMatchObject({ label: "broken" });
    });

    it("throws on invalid schema", () => {
      expect(() =>
        runStructuredOutputEngine(JSON.stringify({ confidence: 2 }), {
          schema: testSchema,
          schemaName: "test",
          maxRepairAttempts: 0,
        }),
      ).toThrow(AIPlatformError);
    });
  });

  describe("response validator", () => {
    it("accepts valid confidence and priority", () => {
      expect(() =>
        runResponseValidation(
          { confidence: 0.5, priority: 3 },
          createStandardValidationRules(),
        ),
      ).not.toThrow();
    });

    it("rejects invalid confidence", () => {
      expect(() =>
        runResponseValidation({ confidence: 1.5 }, createStandardValidationRules()),
      ).toThrow(AIPlatformError);
    });

    it("rejects unknown fields", () => {
      expect(() =>
        rejectUnknownFields({ allowed: true, extra: 1 }, ["allowed"]),
      ).toThrow(AIPlatformError);
    });

    it("validates enum fields", () => {
      expect(() => validateEnumField("a", ["a", "b"] as const, "status")).not.toThrow();
      expect(() => validateEnumField("c", ["a", "b"] as const, "status")).toThrow(
        AIPlatformError,
      );
    });
  });

  describe("cache", () => {
    it("stores and retrieves entries by fingerprint", () => {
      const cache = new FoundationCacheService({
        cache: new InMemoryFoundationCache(),
        defaultTtlMs: 60_000,
      });
      const fingerprint = cache.buildFingerprint({
        storeId: "store-1",
        feature: "test",
        promptHash: "abc",
        variables: { metric: 10 },
      });
      cache.store({ fingerprint, data: { label: "cached" } });
      const lookup = cache.lookup<{ label: string }>(fingerprint);
      expect(lookup.hit).toBe(true);
      expect(lookup.entry?.data.label).toBe("cached");
    });

    it("expires entries after ttl", () => {
      vi.useFakeTimers();
      const cache = new InMemoryFoundationCache();
      cache.store({
        fingerprint: "fp",
        data: { label: "old" },
        ttlMs: 1000,
      });
      vi.advanceTimersByTime(1500);
      expect(cache.lookup("fp").hit).toBe(false);
      vi.useRealTimers();
    });

    it("invalidates store-scoped keys on webhook", () => {
      const cache = new FoundationCacheService();
      const fp = cache.buildFingerprint({
        storeId: "store-1",
        feature: "orders/update",
        promptHash: "abc",
      });
      cache.store({ fingerprint: fp, data: { label: "x" } });
      expect(cache.invalidateForWebhook("store-1", "orders/update")).toBe(1);
      expect(cache.invalidateStore("store-1")).toBe(0);
    });
  });

  describe("cost manager", () => {
    it("estimates tier-based cost", () => {
      const manager = new CostManager();
      const cost = manager.estimateCost({
        tier: "nano",
        promptTokens: 1000,
        completionTokens: 500,
      });
      expect(cost).toBeGreaterThan(0);
    });

    it("tracks merchant spend snapshots", async () => {
      const ledger = new InMemoryCostLedger();
      const manager = new CostManager({ ledger });
      await manager.record({
        storeId: "store-1",
        feature: "test",
        providerId: "openai",
        modelId: "gpt-4.1-nano",
        modelTier: "nano",
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        latencyMs: 20,
        estimatedCostUsd: 0.01,
        cacheHit: false,
        success: true,
      });
      const snapshot = await manager.getMerchantSnapshot("store-1");
      expect(snapshot.monthlySpendUsd).toBe(0.01);
      expect(snapshot.budgetPercentUsed).toBeGreaterThan(0);
    });
  });

  describe("retry engine", () => {
    it("retries retryable errors with backoff", async () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      let attempts = 0;
      const result = await executeWithRetry(async () => {
        attempts += 1;
        if (attempts < 3) {
          throw AIPlatformError.rateLimited("429");
        }
        return "ok";
      }, { ...DEFAULT_RETRY_POLICY, baseDelayMs: 1, maxDelayMs: 2, jitterMs: 0 });
      expect(result.value).toBe("ok");
      expect(result.attempts).toBe(2);
    });

    it("does not retry non-retryable errors", async () => {
      await expect(
        executeWithRetry(async () => {
          throw AIPlatformError.configuration("bad config");
        }, { ...DEFAULT_RETRY_POLICY, maxAttempts: 3 }),
      ).rejects.toThrow(AIPlatformError);
    });

    it("classifies retryable network and syntax errors", () => {
      expect(isRetryableError(AIPlatformError.timeout("slow"))).toBe(true);
      expect(isRetryableError(new SyntaxError("json"))).toBe(true);
      expect(isRetryableError(new Error("network failure"))).toBe(true);
      expect(isRetryableError(AIPlatformError.configuration("x"))).toBe(false);
    });

    it("computes exponential backoff with cap", () => {
      const delay = computeRetryDelay(3, {
        ...DEFAULT_RETRY_POLICY,
        baseDelayMs: 100,
        maxDelayMs: 500,
        jitterMs: 0,
      });
      expect(delay).toBe(400);
    });
  });

  describe("circuit breaker", () => {
    it("opens after repeated failures", async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 1000,
      });
      await expect(breaker.execute(async () => { throw new Error("fail"); })).rejects.toThrow();
      await expect(breaker.execute(async () => { throw new Error("fail"); })).rejects.toThrow();
      await expect(breaker.execute(async () => "ok")).rejects.toThrow("circuit_breaker_open");
    });
  });

  describe("rate limiter", () => {
    it("allows requests within capacity", () => {
      const limiter = new TokenBucketRateLimiter({
        capacity: 2,
        refillRatePerSecond: 1,
      });
      expect(limiter.consume().allowed).toBe(true);
      expect(limiter.consume().allowed).toBe(true);
      expect(limiter.consume().allowed).toBe(false);
    });
  });

  describe("pii sanitizer", () => {
    it("redacts emails phones and blocked fields", () => {
      expect(sanitizeTextForAi("Contact user@example.com")).toContain("[REDACTED_EMAIL]");
      const sanitized = sanitizeVariablesForAi({
        metric: 10,
        email: "secret@example.com",
        nested: { phone: "555-123-4567" },
      });
      expect(sanitized).not.toHaveProperty("email");
      expect(sanitizeMessagesForAi([{ role: "user", content: "555-123-4567 call" }])[0].content).toContain(
        "[REDACTED_PHONE]",
      );
    });
  });

  describe("metrics", () => {
    it("aggregates log entries into snapshot", () => {
      const metrics = new FoundationMetricsCollector();
      metrics.record({
        timestamp: new Date().toISOString(),
        requestId: "r1",
        storeId: "store-1",
        feature: "test",
        promptId: "foundation.test",
        promptVersion: "v1",
        providerId: "openai",
        modelId: "gpt-4.1-nano",
        modelTier: "nano",
        latencyMs: 100,
        estimatedCostUsd: 0.02,
        cacheHit: false,
        promptTokens: 100,
        completionTokens: 50,
        responseSizeBytes: 200,
        retryCount: 0,
        success: true,
      });
      const snapshot = metrics.snapshot();
      expect(snapshot.totalCostUsd).toBe(0.02);
      expect(snapshot.modelDistribution["gpt-4.1-nano"]).toBe(1);
    });
  });

  describe("foundation pipeline", () => {
    it("executes end-to-end with mocked provider", async () => {
      const mock = new MockFoundationProvider("openai", {
        structuredResponses: [JSON.stringify({ label: "pipeline-ok", confidence: 0.7 })],
      });
      const ledger = new InMemoryCostLedger();
      const pipeline = createFoundationPipeline({
        promptRegistry: createTestPromptRegistry(),
        providerRouter: createMockProviderRouter(mock),
        costManager: new CostManager({ ledger }),
        cache: new FoundationCacheService({ cache: new InMemoryFoundationCache() }),
      });

      const response = await pipeline.execute({
        promptId: "foundation.test",
        messages: [{ role: "user", content: "Summarize metric 42" }],
        variables: { metric: 42 },
        context: {
          storeId: "store-1",
          feature: "foundation-test",
          taskCategory: "classification",
        },
        output: {
          schema: testSchema,
          schemaName: "foundation.test",
        },
      });

      expect(response.ok).toBe(true);
      if (response.ok) {
        expect(response.data.label).toBe("pipeline-ok");
        expect(response.cache).toBe("miss");
        expect(response.modelTier).toBe("nano");
      }
      expect(mock.calls.length).toBe(1);
    });

    it("returns cached responses without calling provider twice", async () => {
      const mock = new MockFoundationProvider("openai");
      const pipeline = createFoundationPipeline({
        promptRegistry: createTestPromptRegistry(),
        providerRouter: createMockProviderRouter(mock),
        cache: new FoundationCacheService({ cache: new InMemoryFoundationCache() }),
      });

      const request = {
        promptId: "foundation.test",
        messages: [{ role: "user" as const, content: "metric" }],
        variables: { metric: 1 },
        context: {
          storeId: "store-1",
          feature: "cache-test",
          taskCategory: "classification" as const,
        },
        output: {
          schema: testSchema,
          schemaName: "foundation.test",
        },
      };

      const first = await pipeline.execute(request);
      const second = await pipeline.execute(request);
      expect(first.ok && second.ok).toBe(true);
      if (first.ok && second.ok) {
        expect(first.cache).toBe("miss");
        expect(second.cache).toBe("hit");
      }
      expect(mock.calls.length).toBe(1);
    });

    it("retries validation failures and succeeds", async () => {
      const mock = new MockFoundationProvider("openai", {
        structuredResponses: [
          JSON.stringify({ confidence: 5 }),
          JSON.stringify({ label: "recovered", confidence: 0.5 }),
        ],
      });
      const pipeline = createFoundationPipeline({
        promptRegistry: createTestPromptRegistry(),
        providerRouter: createMockProviderRouter(mock),
      });

      const response = await pipeline.execute({
        promptId: "foundation.test",
        messages: [{ role: "user", content: "validate" }],
        context: {
          storeId: "store-1",
          feature: "validation-retry",
          taskCategory: "validation",
        },
        output: {
          schema: testSchema,
          schemaName: "foundation.test",
          maxValidationRetries: 2,
        },
      });

      expect(response.ok).toBe(true);
      expect(mock.calls.length).toBe(2);
    });
  });

  describe("hash utilities", () => {
    it("hashes objects deterministically regardless of key order", () => {
      expect(hashObject({ b: 2, a: 1 })).toBe(hashObject({ a: 1, b: 2 }));
    });
  });
});
