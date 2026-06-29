export const GOOGLE_API_ERROR_CODES = [
  "expired_token",
  "invalid_grant",
  "revoked_consent",
  "quota_exceeded",
  "missing_property",
  "permission_denied",
  "network_failure",
  "invalid_response",
  "configuration_missing",
  "rate_limited",
] as const;

export type GoogleApiErrorCode = (typeof GOOGLE_API_ERROR_CODES)[number];

export class GoogleApiError extends Error {
  readonly code: GoogleApiErrorCode;
  readonly statusCode?: number;
  readonly retryable: boolean;
  readonly cause?: unknown;

  constructor(input: {
    code: GoogleApiErrorCode;
    message: string;
    statusCode?: number;
    retryable?: boolean;
    cause?: unknown;
  }) {
    super(input.message);
    this.name = "GoogleApiError";
    this.code = input.code;
    this.statusCode = input.statusCode;
    this.retryable = input.retryable ?? false;
    this.cause = input.cause;
  }
}

export function isGoogleApiError(error: unknown): error is GoogleApiError {
  return error instanceof GoogleApiError;
}

export function mapGoogleHttpStatusToError(input: {
  statusCode: number;
  message: string;
  body?: string;
}): GoogleApiError {
  const normalized = `${input.message} ${input.body ?? ""}`.toLowerCase();

  if (input.statusCode === 401) {
    if (normalized.includes("invalid_grant")) {
      return new GoogleApiError({
        code: "invalid_grant",
        message: input.message,
        statusCode: input.statusCode,
        retryable: false,
      });
    }

    return new GoogleApiError({
      code: "expired_token",
      message: input.message,
      statusCode: input.statusCode,
      retryable: true,
    });
  }

  if (input.statusCode === 403) {
    if (normalized.includes("quota") || normalized.includes("rate limit")) {
      return new GoogleApiError({
        code: "quota_exceeded",
        message: input.message,
        statusCode: input.statusCode,
        retryable: true,
      });
    }

    return new GoogleApiError({
      code: "permission_denied",
      message: input.message,
      statusCode: input.statusCode,
      retryable: false,
    });
  }

  if (input.statusCode === 404) {
    return new GoogleApiError({
      code: "missing_property",
      message: input.message,
      statusCode: input.statusCode,
      retryable: false,
    });
  }

  if (input.statusCode === 429) {
    return new GoogleApiError({
      code: "rate_limited",
      message: input.message,
      statusCode: input.statusCode,
      retryable: true,
    });
  }

  if (input.statusCode >= 500) {
    return new GoogleApiError({
      code: "network_failure",
      message: input.message,
      statusCode: input.statusCode,
      retryable: true,
    });
  }

  return new GoogleApiError({
    code: "invalid_response",
    message: input.message,
    statusCode: input.statusCode,
    retryable: false,
  });
}

export function mapGoogleFetchError(error: unknown): GoogleApiError {
  if (isGoogleApiError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new GoogleApiError({
      code: "network_failure",
      message: error.message,
      retryable: true,
      cause: error,
    });
  }

  return new GoogleApiError({
    code: "network_failure",
    message: String(error),
    retryable: true,
    cause: error,
  });
}
