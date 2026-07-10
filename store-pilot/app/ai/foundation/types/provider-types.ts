import type { z } from "zod";

import type {
  FoundationMessage,
  FoundationProviderId,
  FoundationTokenUsage,
} from "./foundation-types";

export type ProviderGenerateInput = {
  model: string;
  messages: FoundationMessage[];
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  metadata?: Record<string, string>;
};

export type ProviderStructuredInput<TSchema extends z.ZodTypeAny> =
  ProviderGenerateInput & {
    schema: TSchema;
    schemaName: string;
  };

export type ProviderGenerateResult = {
  content: string;
  model: string;
  usage: FoundationTokenUsage;
  finishReason: string | null;
  latencyMs: number;
};

export type ProviderStructuredResult<TOutput> = {
  data: TOutput;
  model: string;
  usage: FoundationTokenUsage;
  finishReason: string | null;
  latencyMs: number;
  rawContent: string;
};

export type ProviderCapability = {
  supportsStructuredOutput: boolean;
  supportsJsonSchema: boolean;
  contextWindowTokens: number | null;
};

export type ProviderHealthStatus = {
  providerId: FoundationProviderId;
  healthy: boolean;
  latencyMs: number;
  message?: string;
};

export type ProviderCostRates = {
  promptUsdPer1k: number;
  completionUsdPer1k: number;
};
