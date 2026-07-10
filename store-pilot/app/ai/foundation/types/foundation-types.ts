import type { z } from "zod";

export type FoundationProviderId =
  | "openai"
  | "anthropic"
  | "gemini"
  | "grok"
  | "local";

export type FoundationModelTier =
  | "reasoning"
  | "standard"
  | "fast"
  | "nano";

export type FoundationTaskCategory =
  | "executive_reasoning"
  | "cross_system_diagnosis"
  | "business_simulation"
  | "strategic_planning"
  | "root_cause_reasoning"
  | "report_writing"
  | "recommendation_generation"
  | "executive_summary"
  | "daily_report"
  | "short_summary"
  | "rewrite"
  | "classification"
  | "extraction"
  | "tagging"
  | "validation"
  | "json_repair";

export type FoundationMessageRole = "system" | "user" | "assistant";

export type FoundationMessage = {
  role: FoundationMessageRole;
  content: string;
};

export type FoundationTokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type FoundationRequestContext = {
  storeId: string;
  merchantId?: string;
  agentId?: string;
  feature: string;
  taskCategory: FoundationTaskCategory;
  subjectKey?: string;
  metadata?: Record<string, string>;
};

export type FoundationStructuredOutputOptions<TSchema extends z.ZodTypeAny> = {
  schema: TSchema;
  schemaName: string;
  strict?: boolean;
  maxRepairAttempts?: number;
  maxValidationRetries?: number;
};

export type FoundationRequest<TSchema extends z.ZodTypeAny = z.ZodTypeAny> = {
  promptId: string;
  promptVersion?: string;
  messages: FoundationMessage[];
  variables?: Record<string, unknown>;
  context: FoundationRequestContext;
  output: FoundationStructuredOutputOptions<TSchema>;
  forceRefresh?: boolean;
  cacheTtlMs?: number;
  /** When true, send request.messages directly without prepending the prompt template body. */
  useDirectMessages?: boolean;
};

export type FoundationCacheStatus = "hit" | "miss" | "bypass";

export type FoundationCostRecord = {
  providerId: FoundationProviderId;
  modelId: string;
  modelTier: FoundationModelTier;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  estimatedCostUsd: number;
  cacheHit: boolean;
};

export type FoundationSuccessResponse<TOutput> = {
  ok: true;
  requestId: string;
  data: TOutput;
  providerId: FoundationProviderId;
  modelId: string;
  modelTier: FoundationModelTier;
  promptId: string;
  promptVersion: string;
  usage: FoundationTokenUsage;
  latencyMs: number;
  estimatedCostUsd: number;
  cache: FoundationCacheStatus;
  retryCount: number;
  validationRetries: number;
  downgradedTier: boolean;
};

export type FoundationFailureResponse = {
  ok: false;
  requestId: string;
  errorCode: string;
  message: string;
  retryable: boolean;
  providerId?: FoundationProviderId;
  modelId?: string;
  modelTier?: FoundationModelTier;
  latencyMs: number;
  retryCount: number;
};

export type FoundationResponse<TOutput> =
  | FoundationSuccessResponse<TOutput>
  | FoundationFailureResponse;

export type FoundationPromptDefinition = {
  id: string;
  version: string;
  author: string;
  description: string;
  body: string;
  inputSchema: string;
  outputSchema: string;
  temperature: number;
  defaultTier: FoundationModelTier;
  createdAt: string;
};

export type FoundationValidationRule<T = unknown> = {
  id: string;
  description: string;
  validate: (payload: T) => void;
};

export type FoundationMetricsSnapshot = {
  averageLatencyMs: number;
  cacheHitRate: number;
  totalTokens: number;
  totalCostUsd: number;
  failureRate: number;
  retryRate: number;
  providerUptime: Record<string, number>;
  modelDistribution: Record<string, number>;
  dailySpendUsd: number;
  monthlySpendUsd: number;
};
