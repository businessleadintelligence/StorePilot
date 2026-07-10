import { isAIPlatformError } from "../../core/ai-errors";

export type RetryPolicy = {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterMs: number;
};

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 4,
  baseDelayMs: 500,
  maxDelayMs: 15_000,
  jitterMs: 250,
};

export type RetryExecutionResult<T> = {
  value: T;
  attempts: number;
};

export function isRetryableError(error: unknown): boolean {
  if (isAIPlatformError(error)) {
    return error.retryable;
  }

  if (error instanceof SyntaxError) {
    return true;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("timeout") ||
      message.includes("network") ||
      message.includes("429") ||
      message.includes("rate")
    );
  }

  return false;
}

export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
): Promise<RetryExecutionResult<T>> {
  let attempts = 0;
  let lastError: unknown;

  while (attempts < policy.maxAttempts) {
    attempts += 1;
    try {
      const value = await operation();
      return { value, attempts: attempts - 1 };
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error) || attempts >= policy.maxAttempts) {
        break;
      }
      await sleep(computeRetryDelay(attempts, policy));
    }
  }

  throw lastError;
}

export function computeRetryDelay(attempt: number, policy: RetryPolicy): number {
  const exponential = policy.baseDelayMs * 2 ** Math.max(attempt - 1, 0);
  const capped = Math.min(exponential, policy.maxDelayMs);
  const jitter = Math.floor(Math.random() * policy.jitterMs);
  return capped + jitter;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
