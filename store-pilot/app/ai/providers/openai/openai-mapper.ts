import { AIPlatformError } from "../../core/ai-errors";
import type { AIErrorCode } from "../../core/ai-errors";

type ProviderErrorShape = {
  status?: number;
  code?: string;
  message?: string;
};

export function mapOpenAIError(error: unknown): AIPlatformError {
  if (error instanceof AIPlatformError) {
    return error;
  }

  const shape = normalizeErrorShape(error);
  const code = classifyOpenAIError(shape);

  return new AIPlatformError({
    code,
    message: shape.message ?? "OpenAI provider request failed",
    retryable: code === "rate_limited" || code === "timeout" || code === "provider_unavailable",
    cause: error,
    metadata: shape.code ? { providerCode: shape.code } : undefined,
  });
}

function normalizeErrorShape(error: unknown): ProviderErrorShape {
  if (error instanceof Error) {
    const maybeStatus = (error as Error & { status?: number }).status;
    const maybeCode = (error as Error & { code?: string }).code;
    return {
      status: maybeStatus,
      code: maybeCode,
      message: error.message,
    };
  }

  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;
    return {
      status: typeof record.status === "number" ? record.status : undefined,
      code: typeof record.code === "string" ? record.code : undefined,
      message: typeof record.message === "string" ? record.message : "Unknown provider error",
    };
  }

  return {
    message: typeof error === "string" ? error : "Unknown provider error",
  };
}

function classifyOpenAIError(shape: ProviderErrorShape): AIErrorCode {
  if (shape.status === 429 || shape.code === "rate_limit_exceeded") {
    return "rate_limited";
  }

  if (shape.status === 408 || shape.code === "timeout") {
    return "timeout";
  }

  if (shape.status === 401 || shape.status === 403) {
    return "configuration_error";
  }

  if (typeof shape.status === "number" && shape.status >= 500) {
    return "provider_unavailable";
  }

  return "unknown";
}

export function parseStructuredContent<T>(content: string): T {
  try {
    return JSON.parse(content) as T;
  } catch (error) {
    throw AIPlatformError.invalidResponse("Provider returned invalid JSON", error);
  }
}

export function buildOpenAIModelInfo(input: {
  model: string;
  supportsStructuredOutput: boolean;
  contextWindowTokens: number | null;
  description?: string;
}) {
  return {
    provider: "openai",
    model: input.model,
    supportsStructuredOutput: input.supportsStructuredOutput,
    contextWindowTokens: input.contextWindowTokens,
    description: input.description,
  };
}
