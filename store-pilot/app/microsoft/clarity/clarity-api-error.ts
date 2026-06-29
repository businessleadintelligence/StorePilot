export const CLARITY_API_ERROR_CODES = [
  "expired_token",
  "revoked_credentials",
  "missing_project",
  "permission_denied",
  "quota_exceeded",
  "rate_limited",
  "network_failure",
  "invalid_response",
  "configuration_missing",
] as const;

export type ClarityApiErrorCode = (typeof CLARITY_API_ERROR_CODES)[number];

export class ClarityApiError extends Error {
  readonly code: ClarityApiErrorCode;
  readonly statusCode?: number;
  readonly retryable: boolean;
  readonly cause?: unknown;

  constructor(input: {
    code: ClarityApiErrorCode;
    message: string;
    statusCode?: number;
    retryable?: boolean;
    cause?: unknown;
  }) {
    super(input.message);
    this.name = "ClarityApiError";
    this.code = input.code;
    this.statusCode = input.statusCode;
    this.retryable = input.retryable ?? false;
    this.cause = input.cause;
  }
}

export function isClarityApiError(error: unknown): error is ClarityApiError {
  return error instanceof ClarityApiError;
}

export function mapClarityHttpStatusToError(input: {
  statusCode: number;
  message: string;
  body?: string;
}): ClarityApiError {
  const normalized = `${input.message} ${input.body ?? ""}`.toLowerCase();

  if (input.statusCode === 401) {
    return new ClarityApiError({
      code: normalized.includes("expired") ? "expired_token" : "revoked_credentials",
      message: input.message,
      statusCode: input.statusCode,
      retryable: false,
    });
  }

  if (input.statusCode === 403) {
    return new ClarityApiError({
      code: "permission_denied",
      message: input.message,
      statusCode: input.statusCode,
      retryable: false,
    });
  }

  if (input.statusCode === 400) {
    return new ClarityApiError({
      code: "invalid_response",
      message: input.message,
      statusCode: input.statusCode,
      retryable: false,
    });
  }

  if (input.statusCode === 429) {
    return new ClarityApiError({
      code: normalized.includes("daily") ? "quota_exceeded" : "rate_limited",
      message: input.message,
      statusCode: input.statusCode,
      retryable: true,
    });
  }

  if (input.statusCode >= 500) {
    return new ClarityApiError({
      code: "network_failure",
      message: input.message,
      statusCode: input.statusCode,
      retryable: true,
    });
  }

  return new ClarityApiError({
    code: "invalid_response",
    message: input.message,
    statusCode: input.statusCode,
    retryable: false,
  });
}

export function mapClarityFetchError(error: unknown): ClarityApiError {
  if (isClarityApiError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new ClarityApiError({
      code: "network_failure",
      message: error.message,
      retryable: true,
      cause: error,
    });
  }

  return new ClarityApiError({
    code: "network_failure",
    message: String(error),
    retryable: true,
    cause: error,
  });
}
