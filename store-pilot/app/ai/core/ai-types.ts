import type { z } from "zod";

export type AIProviderId = string;

export type AIMessageRole = "system" | "user" | "assistant";

export type AIMessage = {
  role: AIMessageRole;
  content: string;
};

export type AIGenerateRequest = {
  messages: AIMessage[];
  config: AIRequestConfig;
  metadata?: Record<string, string>;
};

export type AIRequestConfig = {
  provider: AIProviderId;
  model: string;
  temperature: number;
  maxTokens: number;
  structuredOutputEnabled: boolean;
  timeoutMs?: number;
};

export type AITokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type AIGenerateResponse = {
  content: string;
  model: string;
  provider: AIProviderId;
  usage: AITokenUsage;
  latencyMs: number;
  finishReason: string | null;
  rawMetadata?: Record<string, unknown>;
};

export type AIStructuredRequest<TSchema extends z.ZodTypeAny = z.ZodTypeAny> = {
  messages: AIMessage[];
  config: AIRequestConfig;
  schema: TSchema;
  schemaName: string;
  metadata?: Record<string, string>;
};

export type AIStructuredResponse<TOutput> = {
  data: TOutput;
  model: string;
  provider: AIProviderId;
  usage: AITokenUsage;
  latencyMs: number;
  finishReason: string | null;
  validationStatus: "valid";
  rawMetadata?: Record<string, unknown>;
};

export type AICostEstimateRequest = {
  config: AIRequestConfig;
  promptTokens: number;
  completionTokens: number;
};

export type AICostEstimate = {
  provider: AIProviderId;
  model: string;
  promptTokens: number;
  completionTokens: number;
  estimatedCostUsd: number;
  currency: "USD";
};

export type AIModelInfo = {
  provider: AIProviderId;
  model: string;
  supportsStructuredOutput: boolean;
  contextWindowTokens: number | null;
  description?: string;
};

export type AIHealthCheckResult = {
  provider: AIProviderId;
  healthy: boolean;
  latencyMs: number;
  message?: string;
};

export type AIExecutionStatus = "success" | "failure";

export type AIValidationStatus = "valid" | "invalid" | "skipped";

export type AIExecutionLogEntry = {
  timestamp: string;
  agentId?: string;
  provider: AIProviderId;
  model: string;
  promptId?: string;
  promptVersion?: string;
  latencyMs: number;
  estimatedCostUsd: number | null;
  tokens: AITokenUsage;
  status: AIExecutionStatus;
  validationStatus: AIValidationStatus;
  errorCode?: string;
  operation: string;
};

export type AgentRunInput<TFacts = Record<string, unknown>> = {
  storeId: string;
  facts: TFacts;
  metadata?: Record<string, string>;
};

export type AgentRunResult<TOutput> = {
  agentId: string;
  output: TOutput;
  provider: AIProviderId;
  model: string;
  promptId: string;
  promptVersion: string;
  latencyMs: number;
  estimatedCostUsd: number | null;
  tokens: AITokenUsage;
  validationStatus: AIValidationStatus;
};

export type UnifiedFinding = {
  id: string;
  sourceAgentId: string;
  category: string;
  title: string;
  summary: string;
  priority: number;
  confidence: number;
  impact: string;
  metadata?: Record<string, string>;
};

export type UnifiedReport = {
  storeId: string;
  generatedAt: string;
  findings: UnifiedFinding[];
  agentsExecuted: string[];
  totalLatencyMs: number;
  totalEstimatedCostUsd: number;
};
