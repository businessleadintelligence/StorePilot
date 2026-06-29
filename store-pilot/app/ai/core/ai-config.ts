import { AIPlatformError } from "./ai-errors";
import type { AIProviderId, AIRequestConfig } from "./ai-types";

export type AIConfig = {
  provider: AIProviderId;
  model: string;
  temperature: number;
  maxTokens: number;
  structuredOutputEnabled: boolean;
  timeoutMs: number;
};

export type AIConfigSource = {
  provider?: string;
  model?: string;
  temperature?: string;
  maxTokens?: string;
  structuredOutputEnabled?: string;
  timeoutMs?: string;
};

const DEFAULT_TIMEOUT_MS = 30_000;

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function parseNumber(
  value: string | undefined,
  field: string,
  fallback?: number,
): number {
  if (value === undefined || value.trim() === "") {
    if (fallback === undefined) {
      throw AIPlatformError.configuration(`${field} is required`);
    }
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw AIPlatformError.configuration(`${field} must be a valid number`);
  }

  return parsed;
}

export function loadAIConfig(source: AIConfigSource = process.env): AIConfig {
  const provider = source.provider?.trim();
  const model = source.model?.trim();

  if (!provider) {
    throw AIPlatformError.configuration("AI_PROVIDER is required");
  }

  if (!model) {
    throw AIPlatformError.configuration("AI_MODEL is required");
  }

  const temperature = parseNumber(source.temperature, "AI_TEMPERATURE", 0.2);
  const maxTokens = parseNumber(source.maxTokens, "AI_MAX_TOKENS", 2048);
  const timeoutMs = parseNumber(source.timeoutMs, "AI_TIMEOUT_MS", DEFAULT_TIMEOUT_MS);

  if (temperature < 0 || temperature > 2) {
    throw AIPlatformError.configuration("AI_TEMPERATURE must be between 0 and 2");
  }

  if (maxTokens <= 0) {
    throw AIPlatformError.configuration("AI_MAX_TOKENS must be greater than 0");
  }

  if (timeoutMs <= 0) {
    throw AIPlatformError.configuration("AI_TIMEOUT_MS must be greater than 0");
  }

  return {
    provider,
    model,
    temperature,
    maxTokens,
    structuredOutputEnabled: parseBoolean(source.structuredOutputEnabled, true),
    timeoutMs,
  };
}

export function toRequestConfig(config: AIConfig): AIRequestConfig {
  return {
    provider: config.provider,
    model: config.model,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    structuredOutputEnabled: config.structuredOutputEnabled,
    timeoutMs: config.timeoutMs,
  };
}
