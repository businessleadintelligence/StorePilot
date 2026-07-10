import { Prisma } from "@prisma/client";

export type PrismaRetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  label?: string;
  onRetry?: (context: PrismaRetryAttemptContext) => void;
};

export type PrismaRetryAttemptContext = {
  attempt: number;
  maxAttempts: number;
  delayMs: number;
  label?: string;
  error: unknown;
};

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 100;
const DEFAULT_MAX_DELAY_MS = 2_000;

/** Prisma / Postgres codes that may succeed on retry. */
const TRANSIENT_PRISMA_CODES = new Set([
  "P1001", // Can't reach database server
  "P1008", // Operations timed out
  "P1017", // Server closed the connection
  "P2024", // Timed out fetching a new connection from the pool
  "P2034", // Transaction failed due to serialization / deadlock
]);

/** Non-retryable Prisma codes (constraint, FK, validation). */
const NON_RETRYABLE_PRISMA_CODES = new Set([
  "P2000", // Value too long
  "P2001", // Record not found
  "P2002", // Unique constraint
  "P2003", // Foreign key constraint
  "P2004", // Constraint failed on database
  "P2005", // Invalid value stored
  "P2006", // Invalid value provided
  "P2007", // Data validation error
  "P2008", // Query parsing failed
  "P2009", // Query validation failed
  "P2010", // Raw query failed
  "P2011", // Null constraint
  "P2012", // Missing required value
  "P2013", // Missing required argument
  "P2014", // Relation violation
  "P2015", // Related record not found
  "P2016", // Query interpretation error
  "P2017", // Records not connected
  "P2018", // Required connected records not found
  "P2019", // Input error
  "P2020", // Value out of range
  "P2021", // Table does not exist
  "P2022", // Column does not exist
  "P2023", // Inconsistent column data
  "P2025", // Record not found (operation)
  "P2026", // Unsupported feature
  "P2027", // Multiple errors
]);

const TRANSIENT_MESSAGE_PATTERNS: RegExp[] = [
  /connection pool timeout/i,
  /timed out fetching a new connection from the connection pool/i,
  /connection reset/i,
  /could not serialize access/i,
  /serialization failure/i,
  /deadlock detected/i,
  /server has closed the connection/i,
  /can't reach database server/i,
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /EPIPE/i,
];

function getPrismaErrorCode(error: unknown): string | undefined {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }

  return undefined;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function isNonRetryablePrismaError(error: unknown): boolean {
  const code = getPrismaErrorCode(error);
  if (code && NON_RETRYABLE_PRISMA_CODES.has(code)) {
    return true;
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return true;
  }

  return false;
}

export function isTransientPrismaError(error: unknown): boolean {
  if (isNonRetryablePrismaError(error)) {
    return false;
  }

  const code = getPrismaErrorCode(error);
  if (code && TRANSIENT_PRISMA_CODES.has(code)) {
    return true;
  }

  const message = getErrorMessage(error);
  return TRANSIENT_MESSAGE_PATTERNS.some((pattern) => pattern.test(message));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function computeBackoffDelayMs(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
): number {
  const exponential = baseDelayMs * 2 ** (attempt - 1);
  const capped = Math.min(exponential, maxDelayMs);
  const jitter = Math.floor(Math.random() * Math.max(1, Math.floor(capped * 0.25)));
  return capped + jitter;
}

/**
 * Retry a Prisma operation on transient connection / pool / serialization failures.
 * Never retries unique constraint, FK, or validation errors.
 */
export async function withPrismaRetry<T>(
  operation: () => Promise<T>,
  options: PrismaRetryOptions = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isTransientPrismaError(error) || attempt >= maxAttempts) {
        throw error;
      }

      const delayMs = computeBackoffDelayMs(attempt, baseDelayMs, maxDelayMs);
      options.onRetry?.({
        attempt,
        maxAttempts,
        delayMs,
        label: options.label,
        error,
      });

      await sleep(delayMs);
    }
  }

  throw lastError;
}
