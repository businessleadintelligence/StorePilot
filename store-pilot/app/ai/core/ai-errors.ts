export type AIErrorCode =
  | "configuration_error"
  | "provider_unavailable"
  | "rate_limited"
  | "timeout"
  | "invalid_response"
  | "schema_validation_failed"
  | "business_rule_validation_failed"
  | "prompt_not_found"
  | "agent_execution_failed"
  | "unknown";

export type AIErrorDetails = {
  code: AIErrorCode;
  message: string;
  retryable: boolean;
  cause?: unknown;
  metadata?: Record<string, string>;
};

export class AIPlatformError extends Error {
  readonly code: AIErrorCode;
  readonly retryable: boolean;
  readonly metadata?: Record<string, string>;

  constructor(details: AIErrorDetails) {
    super(details.message);
    this.name = "AIPlatformError";
    this.code = details.code;
    this.retryable = details.retryable;
    this.metadata = details.metadata;

    if (details.cause instanceof Error) {
      this.cause = details.cause;
    }
  }

  static configuration(message: string, metadata?: Record<string, string>): AIPlatformError {
    return new AIPlatformError({
      code: "configuration_error",
      message,
      retryable: false,
      metadata,
    });
  }

  static providerUnavailable(message: string, cause?: unknown): AIPlatformError {
    return new AIPlatformError({
      code: "provider_unavailable",
      message,
      retryable: true,
      cause,
    });
  }

  static rateLimited(message: string): AIPlatformError {
    return new AIPlatformError({
      code: "rate_limited",
      message,
      retryable: true,
    });
  }

  static timeout(message: string): AIPlatformError {
    return new AIPlatformError({
      code: "timeout",
      message,
      retryable: true,
    });
  }

  static invalidResponse(message: string, cause?: unknown): AIPlatformError {
    return new AIPlatformError({
      code: "invalid_response",
      message,
      retryable: false,
      cause,
    });
  }

  static schemaValidation(message: string, cause?: unknown): AIPlatformError {
    return new AIPlatformError({
      code: "schema_validation_failed",
      message,
      retryable: false,
      cause,
    });
  }

  static businessRuleValidation(message: string): AIPlatformError {
    return new AIPlatformError({
      code: "business_rule_validation_failed",
      message,
      retryable: false,
    });
  }

  static promptNotFound(promptId: string): AIPlatformError {
    return new AIPlatformError({
      code: "prompt_not_found",
      message: `Prompt not found: ${promptId}`,
      retryable: false,
      metadata: { promptId },
    });
  }

  static agentExecution(agentId: string, message: string, cause?: unknown): AIPlatformError {
    return new AIPlatformError({
      code: "agent_execution_failed",
      message: `[${agentId}] ${message}`,
      retryable: false,
      cause,
      metadata: { agentId },
    });
  }

  static unknown(message: string, cause?: unknown): AIPlatformError {
    return new AIPlatformError({
      code: "unknown",
      message,
      retryable: false,
      cause,
    });
  }
}

export function isAIPlatformError(error: unknown): error is AIPlatformError {
  return error instanceof AIPlatformError;
}
