import type { z } from "zod";

import { AIPlatformError, isAIPlatformError } from "../core/ai-errors";
import { FoundationCacheService } from "./cache/cache-service";
import { CostManager } from "./cost/cost-manager";
import { FoundationLogger } from "./logging/foundation-logger";
import { FoundationMetricsCollector } from "./metrics/metrics-collector";
import { resolveModelRoute } from "./model-router/routing-policy";
import { buildPromptMetadata, renderPromptTemplate, resolvePromptDefinition } from "./prompt-registry/registry";
import type { PromptRegistryStore } from "./prompt-registry/registry";
import { createProviderRouter, type ProviderRouter } from "./provider-router/router";
import { createStandardValidationRules, runResponseValidation } from "./response-validator/validator";
import { createDefaultCircuitBreaker, executeWithRetry } from "./retry";
import { createDefaultRateLimiter } from "./rate-limit/rate-limiter";
import { runStructuredOutputEngine } from "./structured-output/engine";
import type { FoundationTelemetryWriter } from "./telemetry/foundation-telemetry";
import type {
  FoundationFailureResponse,
  FoundationRequest,
  FoundationResponse,
  FoundationSuccessResponse,
} from "./types/foundation-types";
import {
  createRequestId,
} from "./utils/json";
import {
  sanitizeMessagesForAi,
  sanitizeVariablesForAi,
} from "./utils/pii-sanitizer";

export type FoundationPipelineDependencies = {
  promptRegistry: PromptRegistryStore;
  providerRouter?: ProviderRouter;
  cache?: FoundationCacheService;
  costManager?: CostManager;
  logger?: FoundationLogger;
  metrics?: FoundationMetricsCollector;
  telemetry?: FoundationTelemetryWriter;
  env?: NodeJS.ProcessEnv;
};

export class FoundationPipeline {
  private readonly providerRouter: ProviderRouter;
  private readonly cache: FoundationCacheService;
  private readonly costManager: CostManager;
  private readonly logger: FoundationLogger;
  private readonly metrics: FoundationMetricsCollector;
  private readonly telemetry: FoundationTelemetryWriter | null;
  private readonly circuitBreaker = createDefaultCircuitBreaker();
  private readonly rateLimiter = createDefaultRateLimiter();
  private readonly env: NodeJS.ProcessEnv;

  constructor(
    private readonly deps: FoundationPipelineDependencies,
  ) {
    this.providerRouter = deps.providerRouter ?? createProviderRouter({ env: deps.env });
    this.cache = deps.cache ?? new FoundationCacheService();
    this.costManager = deps.costManager ?? new CostManager();
    this.logger = deps.logger ?? new FoundationLogger();
    this.metrics = deps.metrics ?? new FoundationMetricsCollector();
    this.telemetry = deps.telemetry ?? null;
    this.env = deps.env ?? process.env;
  }

  async execute<TSchema extends z.ZodTypeAny>(
    request: FoundationRequest<TSchema>,
  ): Promise<FoundationResponse<z.infer<TSchema>>> {
    const requestId = createRequestId("foundation");
    const startedAt = Date.now();
    this.logger.logRequestStart({ requestId, request });

    try {
      const rateLimit = this.rateLimiter.consume();
      if (!rateLimit.allowed) {
        throw AIPlatformError.rateLimited("Foundation rate limit exceeded");
      }

      const prompt = resolvePromptDefinition({
        registry: this.deps.promptRegistry,
        promptId: request.promptId,
        promptVersion: request.promptVersion,
      });
      const promptMeta = buildPromptMetadata(prompt);
      const sanitizedVariables = sanitizeVariablesForAi(request.variables);
      const renderedPrompt = renderPromptTemplate(prompt.body, sanitizedVariables ?? {});
      const fingerprint = this.cache.buildFingerprint({
        storeId: request.context.storeId,
        feature: request.context.feature,
        subjectKey: request.context.subjectKey,
        promptHash: promptMeta.hash,
        variables: sanitizedVariables,
      });

      const spend = await this.costManager.getMerchantSnapshot(request.context.storeId);
      const route = resolveModelRoute({
        taskCategory: request.context.taskCategory,
        monthlyBudgetUsd: spend.monthlyBudgetUsd,
        monthlySpendUsd: spend.monthlySpendUsd,
        env: this.env,
      });

      if (!request.forceRefresh) {
        const cached = this.cache.lookup<z.infer<TSchema>>(fingerprint);
        if (cached.hit && cached.entry) {
          const success = this.buildSuccessResponse({
            requestId,
            request,
            prompt,
            data: cached.entry.data,
            providerId: route.route.providerId,
            modelId: "cache",
            modelTier: route.resolvedTier,
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            latencyMs: Date.now() - startedAt,
            estimatedCostUsd: 0,
            cache: "hit",
            retryCount: 0,
            validationRetries: 0,
            downgradedTier: route.downgraded,
          });
          this.finalizeLogging(requestId, request, success);
          return success;
        }
      }

      const provider = this.providerRouter.resolve(route.route.providerId);
      const sanitizedMessages = sanitizeMessagesForAi(request.messages);
      const messages = request.useDirectMessages
        ? sanitizedMessages
        : [
            {
              role: "system" as const,
              content: renderedPrompt,
            },
            ...sanitizedMessages,
          ];

      let validationRetries = 0;
      const maxValidationRetries = request.output.maxValidationRetries ?? 1;
      let retryCount = 0;
      let lastError: unknown;

      while (validationRetries <= maxValidationRetries) {
        try {
          const execution = await this.circuitBreaker.execute(() =>
            executeWithRetry(async () => {
              const result = await provider.generateStructured({
                model: route.route.modelId,
                messages,
                temperature: prompt.temperature,
                maxTokens: Number(this.env.AI_MAX_TOKENS ?? 2048),
                timeoutMs: Number(this.env.AI_TIMEOUT_MS ?? 30_000),
                schema: request.output.schema,
                schemaName: request.output.schemaName,
                metadata: request.context.metadata,
              });

              const structured = runStructuredOutputEngine(result.rawContent, {
                schema: request.output.schema,
                schemaName: request.output.schemaName,
                strict: request.output.strict ?? true,
                maxRepairAttempts: request.output.maxRepairAttempts,
              });

              runResponseValidation(
                structured.data as Record<string, unknown> & {
                  confidence?: number;
                  priority?: number;
                },
                createStandardValidationRules<
                  Record<string, unknown> & { confidence?: number; priority?: number }
                >(),
              );
              return { result, structured };
            }),
          );

          retryCount = execution.attempts;
          const estimatedCostUsd = this.costManager.estimateCost({
            tier: route.resolvedTier,
            promptTokens: execution.value.result.usage.promptTokens,
            completionTokens: execution.value.result.usage.completionTokens,
            env: this.env,
          });

          this.cache.store({
            fingerprint,
            data: execution.value.structured.data,
            ttlMs: request.cacheTtlMs,
          });

          await this.costManager.record({
            storeId: request.context.storeId,
            merchantId: request.context.merchantId,
            agentId: request.context.agentId,
            feature: request.context.feature,
            providerId: route.route.providerId,
            modelId: route.route.modelId,
            modelTier: route.resolvedTier,
            promptTokens: execution.value.result.usage.promptTokens,
            completionTokens: execution.value.result.usage.completionTokens,
            totalTokens: execution.value.result.usage.totalTokens,
            latencyMs: Date.now() - startedAt,
            estimatedCostUsd,
            cacheHit: false,
            success: true,
          });

          const success = this.buildSuccessResponse({
            requestId,
            request,
            prompt,
            data: execution.value.structured.data,
            providerId: route.route.providerId,
            modelId: route.route.modelId,
            modelTier: route.resolvedTier,
            usage: execution.value.result.usage,
            latencyMs: Date.now() - startedAt,
            estimatedCostUsd,
            cache: request.forceRefresh ? "bypass" : "miss",
            retryCount,
            validationRetries,
            downgradedTier: route.downgraded,
          });
          this.finalizeLogging(requestId, request, success);
          return success;
        } catch (error) {
          lastError = error;
          validationRetries += 1;
          if (!shouldRetryValidation(error) || validationRetries > maxValidationRetries) {
            break;
          }
        }
      }

      const failure = this.buildFailureResponse({
        requestId,
        error: lastError,
        latencyMs: Date.now() - startedAt,
        retryCount,
      });
      this.finalizeLogging(requestId, request, failure);
      return failure;
    } catch (error) {
      const failure = this.buildFailureResponse({
        requestId,
        error,
        latencyMs: Date.now() - startedAt,
        retryCount: 0,
      });
      this.finalizeLogging(requestId, request, failure);
      return failure;
    }
  }

  private buildSuccessResponse<TOutput>(input: {
    requestId: string;
    request: FoundationRequest;
    prompt: { id: string; version: string };
    data: TOutput;
    providerId: FoundationSuccessResponse<TOutput>["providerId"];
    modelId: string;
    modelTier: FoundationSuccessResponse<TOutput>["modelTier"];
    usage: FoundationSuccessResponse<TOutput>["usage"];
    latencyMs: number;
    estimatedCostUsd: number;
    cache: FoundationSuccessResponse<TOutput>["cache"];
    retryCount: number;
    validationRetries: number;
    downgradedTier: boolean;
  }): FoundationSuccessResponse<TOutput> {
    return {
      ok: true,
      requestId: input.requestId,
      data: input.data,
      providerId: input.providerId,
      modelId: input.modelId,
      modelTier: input.modelTier,
      promptId: input.prompt.id,
      promptVersion: input.prompt.version,
      usage: input.usage,
      latencyMs: input.latencyMs,
      estimatedCostUsd: input.estimatedCostUsd,
      cache: input.cache,
      retryCount: input.retryCount,
      validationRetries: input.validationRetries,
      downgradedTier: input.downgradedTier,
    };
  }

  private buildFailureResponse(input: {
    requestId: string;
    error: unknown;
    latencyMs: number;
    retryCount: number;
  }): FoundationFailureResponse {
    const { error } = input;
    if (isAIPlatformError(error)) {
      return {
        ok: false,
        requestId: input.requestId,
        errorCode: error.code,
        message: error.message,
        retryable: error.retryable,
        latencyMs: input.latencyMs,
        retryCount: input.retryCount,
      };
    }

    return {
      ok: false,
      requestId: input.requestId,
      errorCode: "unknown",
      message: input.error instanceof Error ? input.error.message : "unknown_error",
      retryable: false,
      latencyMs: input.latencyMs,
      retryCount: input.retryCount,
    };
  }

  private finalizeLogging(
    requestId: string,
    request: FoundationRequest,
    response: FoundationResponse<unknown>,
  ): void {
    this.logger.logRequestComplete({ requestId, request, response });
    const entries = this.logger.getEntries();
    const latest = entries.at(-1);
    if (latest) {
      this.metrics.record(latest);
      void this.telemetry?.write({
        ...latest,
        downgradedTier: response.ok ? response.downgradedTier : false,
        validationRetries: response.ok ? response.validationRetries : 0,
      });
    }
  }
}

function shouldRetryValidation(error: unknown): boolean {
  if (isAIPlatformError(error)) {
    return (
      error.code === "schema_validation_failed" ||
      error.code === "business_rule_validation_failed" ||
      error.code === "invalid_response"
    );
  }
  return error instanceof SyntaxError;
}

export function createFoundationPipeline(
  deps: FoundationPipelineDependencies,
): FoundationPipeline {
  return new FoundationPipeline(deps);
}
