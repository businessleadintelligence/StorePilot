import { ShopifyExecutionError } from "./shopify-errors";

const storeQueues = new Map<string, Promise<unknown>>();

export type RateLimitOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  storeId?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(response: Response): number | null {
  const header = response.headers.get("retry-after");
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const dateMs = Date.parse(header);
  if (Number.isFinite(dateMs)) return Math.max(0, dateMs - Date.now());
  return null;
}

export async function executeWithRateLimit<T>(
  operation: () => Promise<T>,
  options: RateLimitOptions = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 4;
  const baseDelayMs = options.baseDelayMs ?? 250;
  const queueKey = options.storeId ?? "global";

  const run = async (): Promise<T> => {
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (error instanceof ShopifyExecutionError && !error.retryable) {
          throw error;
        }

        if (error instanceof Response) {
          if (error.status === 429) {
            const retryAfterMs = parseRetryAfterMs(error) ?? baseDelayMs * attempt;
            if (attempt < maxAttempts) {
              await sleep(retryAfterMs);
              continue;
            }
            throw new ShopifyExecutionError("rate_limited", "Shopify rate limit exceeded", {
              retryable: true,
            });
          }

          if (error.status >= 500 && attempt < maxAttempts) {
            await sleep(baseDelayMs * 2 ** (attempt - 1));
            continue;
          }
        }

        if (error instanceof ShopifyExecutionError && error.retryable && attempt < maxAttempts) {
          await sleep(baseDelayMs * 2 ** (attempt - 1));
          continue;
        }

        if (error instanceof TypeError && attempt < maxAttempts) {
          throw new ShopifyExecutionError("network_timeout", "Network request failed", {
            retryable: true,
          });
        }

        throw error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error("rate_limit_retries_exhausted");
  };

  const previous = storeQueues.get(queueKey) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(run);
  storeQueues.set(queueKey, next.finally(() => {
    if (storeQueues.get(queueKey) === next) {
      storeQueues.delete(queueKey);
    }
  }));
  return next as Promise<T>;
}

export function clearRateLimitQueues(): void {
  storeQueues.clear();
}
