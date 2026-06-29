import type { z } from "zod";

import { join } from "node:path";

import { loadAIConfig, toRequestConfig } from "../core/ai-config";
import { AIPlatformError, isAIPlatformError } from "../core/ai-errors";
import type { AIProvider } from "../core/ai-provider";
import type { AIStructuredResponse } from "../core/ai-types";
import { createDefaultAIPlatform } from "../providers";
import {
  buildCacheFingerprint,
  buildPromptChecksum,
  buildSubjectKey,
} from "../cache/fingerprint";
import { ResultCacheService } from "../cache/result-cache";
import { ExecutionLifecycleTracker } from "../execution/execution-lifecycle";
import { createFilePromptLoader } from "../prompts/file-prompt-loader";
import type { LoadedPrompt } from "../prompts/prompt-loader";
import {
  extractRecommendationsFromSchemaOutput,
  validateRecommendations,
} from "../validation/recommendation-validator";
import {
  runValidationPipeline,
  shouldRetryMalformedJson,
} from "../validation/validation-pipeline";
import {
  buildTelemetryRecord,
  ConsoleTelemetryWriter,
  type TelemetryWriter,
} from "../telemetry/telemetry-writer";
import {
  CompositeTelemetryWriter,
  PrismaTelemetryWriter,
} from "../telemetry/prisma-telemetry-writer";
import { assertAiBudgetAllowed } from "../telemetry/cost-control";
import { getAgentDefinition } from "../agents/agent-registry";
import type { AgentId } from "../agents/agent-definition";
import { AgentMemoryService } from "../memory/agent-memory.service";
import {
  createRecommendationEngineFromRepository,
  mapCandidatesToRecommendations,
} from "../recommendations/recommendation-engine";
import type { AIPersistenceRepositories } from "../persistence/types";
import { createPrismaAIPersistence } from "../persistence/prisma-persistence";

export type AIOrchestratorExecuteInput = {
  agent: AgentId | string;
  storeId: string;
  context: Record<string, unknown>;
  merchantId?: string;
  force?: boolean;
  merchantContext?: {
    timezone?: string;
    currency?: string;
    storeName?: string;
  };
};

export type AIOrchestratorExecuteResult<T = unknown> = {
  runId: string;
  status: "succeeded" | "cached" | "failed" | "skipped";
  result: T | null;
  fromCache: boolean;
  recommendations: number;
  telemetry: {
    providerId: string;
    modelId: string;
    promptVersion: string;
    promptChecksum: string;
    latencyMs: number;
    totalTokens: number;
    estimatedCostUsd: number;
    retryCount: number;
    validationStatus: string;
  };
  errorCode?: string;
};

export type AIOrchestratorDependencies = {
  persistence: AIPersistenceRepositories;
  provider: AIProvider;
  config: ReturnType<typeof loadAIConfig>;
  loadPrompt: (promptId: string) => Promise<LoadedPrompt>;
  telemetry: TelemetryWriter;
  memory: AgentMemoryService;
  lifecycle: ExecutionLifecycleTracker;
  cache: ResultCacheService;
};

export class AIOrchestrator {
  private readonly recommendations;

  constructor(private readonly deps: AIOrchestratorDependencies) {
    this.recommendations = createRecommendationEngineFromRepository(deps.persistence.recommendations);
  }

  async execute<T = unknown>(input: AIOrchestratorExecuteInput): Promise<AIOrchestratorExecuteResult<T>> {
    const definition = getAgentDefinition(input.agent);
    const subjectKey = buildSubjectKey(definition.id, input.context);
    const factContext = definition.buildFactContext?.(input.context) ?? input.context;
    const facts = await definition.factBuilder.build({
      storeId: input.storeId,
      merchantId: input.merchantId,
      ...factContext,
    });
    const factFingerprint = definition.factBuilder.fingerprint(facts);

    const prompt = await this.deps.loadPrompt(definition.promptId);
    const promptChecksum = buildPromptChecksum(prompt.body);
    const promptVersionRecord = await this.deps.persistence.promptVersions.upsert({
      promptId: prompt.metadata.id,
      version: prompt.metadata.version,
      checksum: promptChecksum,
      description: prompt.metadata.description,
      expectedSchema: prompt.metadata.expectedSchema,
    });

    const inputFingerprint = buildCacheFingerprint({
      agentId: definition.id,
      storeId: input.storeId,
      subjectKey,
      factFingerprint,
      promptVersion: prompt.metadata.version,
      promptChecksum,
    });

    const cacheLookup = await this.deps.cache.lookup<Record<string, unknown>>({
      storeId: input.storeId,
      agentId: definition.id,
      subjectKey,
      inputFingerprint,
      force: input.force,
    });

    if (cacheLookup.hit && cacheLookup.result) {
      const run = await this.deps.persistence.runs.create({
        id: crypto.randomUUID(),
        storeId: input.storeId,
        merchantId: input.merchantId ?? null,
        agentId: definition.id,
        status: "cached",
        validationStatus: "valid",
        subjectKey,
        inputFingerprint,
        contextJson: input.context,
        promptId: prompt.metadata.id,
        promptVersion: prompt.metadata.version,
        promptChecksum,
        promptVersionId: promptVersionRecord.id,
        providerId: this.deps.provider.id,
        modelId: this.deps.config.model,
        retryCount: 0,
        latencyMs: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
        completedAt: new Date().toISOString(),
      });

      return {
        runId: run.id,
        status: "cached",
        result: cacheLookup.result as T,
        fromCache: true,
        recommendations: 0,
        telemetry: {
          providerId: this.deps.provider.id,
          modelId: this.deps.config.model,
          promptVersion: prompt.metadata.version,
          promptChecksum,
          latencyMs: 0,
          totalTokens: 0,
          estimatedCostUsd: 0,
          retryCount: 0,
          validationStatus: "valid",
        },
      };
    }

    const budget = await assertAiBudgetAllowed(input.storeId, 1);
    if (!budget.allowed) {
      const run = await this.deps.persistence.runs.create({
        id: crypto.randomUUID(),
        storeId: input.storeId,
        merchantId: input.merchantId ?? null,
        agentId: definition.id,
        status: "skipped",
        validationStatus: null,
        subjectKey,
        inputFingerprint,
        contextJson: input.context,
        promptId: prompt.metadata.id,
        promptVersion: prompt.metadata.version,
        promptChecksum,
        promptVersionId: promptVersionRecord.id,
        providerId: this.deps.provider.id,
        modelId: this.deps.config.model,
        retryCount: 0,
        latencyMs: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
        errorCode: budget.reason ?? "budget_exceeded",
        errorMessage: "AI budget blocked execution",
        completedAt: new Date().toISOString(),
      });

      return {
        runId: run.id,
        status: "skipped",
        result: null,
        fromCache: false,
        recommendations: 0,
        telemetry: {
          providerId: this.deps.provider.id,
          modelId: this.deps.config.model,
          promptVersion: prompt.metadata.version,
          promptChecksum,
          latencyMs: 0,
          totalTokens: 0,
          estimatedCostUsd: 0,
          retryCount: 0,
          validationStatus: "invalid",
        },
        errorCode: budget.reason ?? "budget_exceeded",
      };
    }

    const runId = crypto.randomUUID();
    this.deps.lifecycle.start({
      id: runId,
      storeId: input.storeId,
      merchantId: input.merchantId ?? null,
      agentId: definition.id,
      subjectKey,
    });
    this.deps.lifecycle.advance(runId, "running");

    const run = await this.deps.persistence.runs.create({
      id: runId,
      storeId: input.storeId,
      merchantId: input.merchantId ?? null,
      agentId: definition.id,
      status: "running",
      validationStatus: null,
      subjectKey,
      inputFingerprint,
      contextJson: input.context,
      promptId: prompt.metadata.id,
      promptVersion: prompt.metadata.version,
      promptChecksum,
      promptVersionId: promptVersionRecord.id,
      providerId: this.deps.provider.id,
      modelId: this.deps.config.model,
      retryCount: 0,
      latencyMs: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
    });

    const memoryContext = await this.deps.memory.loadContext({
      storeId: input.storeId,
      subjectKey,
    });

    const builtPrompt = await definition.promptBuilder.build({
      prompt,
      facts,
      merchantContext: {
        timezone: input.merchantContext?.timezone ?? "UTC",
        currency: input.merchantContext?.currency ?? "USD",
        storeName: input.merchantContext?.storeName,
      },
      memoryContext,
    });

    const requestConfig = toRequestConfig(this.deps.config);
    const startedAt = Date.now();
    let retryCount = 0;
    let validationStatus: "valid" | "retried" | "failed_after_retry" | "invalid" = "valid";
    let parsedOutput: z.infer<typeof definition.schema> | null = null;
    let providerResponse: AIStructuredResponse<z.infer<typeof definition.schema>> | null = null;
    let lastError: AIPlatformError | null = null;

    while (retryCount <= 1) {
      try {
        providerResponse = await this.deps.provider.generateStructured({
          messages: [
            { role: "system", content: builtPrompt.systemMessage },
            { role: "user", content: builtPrompt.userMessage },
          ],
          config: requestConfig,
          schema: definition.schema,
          schemaName: builtPrompt.expectedSchema,
        });

        const validation = await runValidationPipeline({
          schema: definition.schema,
          payload: providerResponse.data,
          facts,
          retryCount,
          validateBusinessRules: definition.validateBusinessRules
            ? async (factValues, output) => definition.validateBusinessRules?.(factValues, output)
            : undefined,
        });

        if (!validation.ok) {
          lastError = validation.error;
          validationStatus = validation.validationStatus;

          if (shouldRetryMalformedJson(validation) && retryCount < 1) {
            retryCount += 1;
            this.deps.lifecycle.advance(runId, "retry", "malformed_json");
            continue;
          }

          break;
        }

        parsedOutput = validation.data;
        validationStatus = validation.validationStatus;
        break;
      } catch (error) {
        lastError = isAIPlatformError(error)
          ? error
          : AIPlatformError.agentExecution(definition.id, "provider_execution_failed", error);
        break;
      }
    }

    const latencyMs = Date.now() - startedAt;

    if (!parsedOutput || !providerResponse) {
      this.deps.lifecycle.advance(runId, "failed", lastError?.code);
      await this.deps.persistence.runs.update(run.id, {
        status: "failed",
        validationStatus,
        retryCount,
        latencyMs,
        errorCode: lastError?.code ?? "validation_failed",
        errorMessage: lastError?.message ?? "Validation failed",
        completedAt: new Date().toISOString(),
      });

      await this.deps.persistence.results.create({
        id: crypto.randomUUID(),
        runId: run.id,
        storeId: input.storeId,
        agentId: definition.id,
        subjectKey,
        inputFingerprint,
        resultJson: {
          errorCode: lastError?.code ?? "validation_failed",
          errorMessage: lastError?.message ?? "Validation failed",
        },
        isSuccess: false,
      });

      return {
        runId: run.id,
        status: "failed",
        result: null,
        fromCache: false,
        recommendations: 0,
        telemetry: {
          providerId: this.deps.provider.id,
          modelId: this.deps.config.model,
          promptVersion: builtPrompt.promptVersion,
          promptChecksum: builtPrompt.promptChecksum,
          latencyMs,
          totalTokens: providerResponse?.usage.totalTokens ?? 0,
          estimatedCostUsd: 0,
          retryCount,
          validationStatus,
        },
        errorCode: lastError?.code ?? "validation_failed",
      };
    }

    const estimate = await this.deps.provider.estimateCost({
      config: requestConfig,
      promptTokens: providerResponse.usage.promptTokens,
      completionTokens: providerResponse.usage.completionTokens,
    });

    const resultRecord = await this.deps.persistence.results.create({
      id: crypto.randomUUID(),
      runId: run.id,
      storeId: input.storeId,
      agentId: definition.id,
      subjectKey,
      inputFingerprint,
      resultJson: parsedOutput as Record<string, unknown>,
      summary: String(
        (parsedOutput as Record<string, unknown>).recommendation ??
          (parsedOutput as Record<string, unknown>).summary ??
          "",
      ),
      priority: Number((parsedOutput as Record<string, unknown>).priority ?? null) || null,
      confidence: Number((parsedOutput as Record<string, unknown>).confidence ?? null) || null,
      isSuccess: true,
    });

    await this.deps.persistence.cache.store({
      storeId: input.storeId,
      agentId: definition.id,
      subjectKey,
      inputFingerprint,
      resultId: resultRecord.id,
    });

    let recommendationCount = 0;
    const candidates =
      definition.extractRecommendations?.({
        agentId: definition.id,
        subjectKey,
        output: parsedOutput,
      }) ?? extractRecommendationsFromSchemaOutput(parsedOutput as Record<string, unknown>);

    if (candidates.length > 0) {
      validateRecommendations(candidates);
      const mapped = mapCandidatesToRecommendations({
        storeId: input.storeId,
        agentId: definition.id,
        runId: run.id,
        subjectKey,
        candidates,
      });
      await this.recommendations.upsertMany(mapped);
      recommendationCount = mapped.length;
    }

    await this.deps.persistence.runs.update(run.id, {
      status: "succeeded",
      validationStatus,
      retryCount,
      latencyMs,
      promptTokens: providerResponse.usage.promptTokens,
      completionTokens: providerResponse.usage.completionTokens,
      totalTokens: providerResponse.usage.totalTokens,
      estimatedCostUsd: estimate.estimatedCostUsd,
      completedAt: new Date().toISOString(),
    });

    this.deps.lifecycle.advance(runId, "succeeded");

    const telemetry = buildTelemetryRecord({
      runId: run.id,
      storeId: input.storeId,
      merchantId: input.merchantId ?? null,
      agentId: definition.id,
      providerId: this.deps.provider.id,
      modelId: this.deps.config.model,
      promptId: builtPrompt.promptId,
      promptVersion: builtPrompt.promptVersion,
      promptChecksum: builtPrompt.promptChecksum,
      latencyMs,
      promptTokens: providerResponse.usage.promptTokens,
      completionTokens: providerResponse.usage.completionTokens,
      totalTokens: providerResponse.usage.totalTokens,
      estimatedCostUsd: estimate.estimatedCostUsd,
      retryCount,
      validationStatus,
      executionStatus: "succeeded",
    });

    await this.deps.telemetry.write(telemetry);

    return {
      runId: run.id,
      status: "succeeded",
      result: parsedOutput as T,
      fromCache: false,
      recommendations: recommendationCount,
      telemetry: {
        providerId: telemetry.providerId,
        modelId: telemetry.modelId,
        promptVersion: telemetry.promptVersion,
        promptChecksum: telemetry.promptChecksum,
        latencyMs: telemetry.latencyMs,
        totalTokens: telemetry.totalTokens,
        estimatedCostUsd: telemetry.estimatedCostUsd,
        retryCount: telemetry.retryCount,
        validationStatus: telemetry.validationStatus,
      },
    };
  }
}

export function createAIOrchestrator(
  deps?: Partial<AIOrchestratorDependencies>,
): AIOrchestrator {
  const persistence = deps?.persistence ?? createPrismaAIPersistence();
  const platform = createDefaultAIPlatform();
  const loadPrompt =
    deps?.loadPrompt ??
    createFilePromptLoader({
      promptsDirectory: join(process.cwd(), "app", "ai", "prompts"),
    }).load;

  return new AIOrchestrator({
    persistence,
    provider: deps?.provider ?? platform.provider,
    config: deps?.config ?? platform.config,
    loadPrompt,
    telemetry: deps?.telemetry ?? new CompositeTelemetryWriter([
      new ConsoleTelemetryWriter(),
      new PrismaTelemetryWriter(),
    ]),
    memory: deps?.memory ?? new AgentMemoryService(persistence.memory),
    lifecycle: deps?.lifecycle ?? new ExecutionLifecycleTracker(),
    cache:
      deps?.cache ??
      new ResultCacheService({
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
}

let orchestratorSingleton: AIOrchestrator | null = null;

export function getAIOrchestrator(deps?: Partial<AIOrchestratorDependencies>): AIOrchestrator {
  if (!orchestratorSingleton || deps) {
    orchestratorSingleton = createAIOrchestrator(deps);
  }

  return orchestratorSingleton;
}

export async function execute(input: AIOrchestratorExecuteInput) {
  return getAIOrchestrator().execute(input);
}
