export type RetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  isRetryable?: (error: unknown, attempt: number) => boolean;
  onRetry?: (input: { attempt: number; error: unknown; delayMs: number }) => void;
};

export const DEFAULT_HTTP_RETRY_ATTEMPTS = 3;
export const DEFAULT_HTTP_RETRY_BASE_DELAY_MS = 250;
export const DEFAULT_HTTP_RETRY_MAX_DELAY_MS = 15_000;

const RETRYABLE_HTTP_STATUS = new Set([408, 429, 500, 502, 503, 504]);

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRetryableHttpStatus(status: number): boolean {
  return RETRYABLE_HTTP_STATUS.has(status);
}

export function isRetryableNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) {
    return true;
  }
  if (error instanceof Error && error.name === "AbortError") {
    return true;
  }
  return false;
}

export function computeRetryDelayMs(
  attempt: number,
  baseDelayMs = DEFAULT_HTTP_RETRY_BASE_DELAY_MS,
  maxDelayMs = DEFAULT_HTTP_RETRY_MAX_DELAY_MS,
): number {
  return Math.min(maxDelayMs, baseDelayMs * 2 ** Math.max(0, attempt - 1));
}

export function parseRetryAfterHeader(response: Response): number | null {
  const header = response.headers.get("retry-after");
  if (!header) {
    return null;
  }
  const seconds = Number(header);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }
  const dateMs = Date.parse(header);
  if (Number.isFinite(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }
  return null;
}

export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_HTTP_RETRY_ATTEMPTS;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_HTTP_RETRY_BASE_DELAY_MS;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_HTTP_RETRY_MAX_DELAY_MS;
  const isRetryable =
    options.isRetryable ??
    ((error: unknown) => isRetryableNetworkError(error));

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt >= maxAttempts || !isRetryable(error, attempt)) {
        throw error;
      }

      let delayMs = computeRetryDelayMs(attempt, baseDelayMs, maxDelayMs);
      if (error instanceof Response) {
        delayMs = parseRetryAfterHeader(error) ?? delayMs;
      }

      options.onRetry?.({ attempt, error, delayMs });
      await sleep(delayMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("retry_exhausted");
}
