const DEFAULT_MAX_REQUESTS_PER_WINDOW = 60;
const DEFAULT_WINDOW_MS = 60_000;

type RateLimitBucket = {
  count: number;
  windowStartedAt: number;
};

const buckets = new Map<string, RateLimitBucket>();

export function resetGoogleRateLimits(): void {
  buckets.clear();
}

export function assertGoogleRateLimit(
  key: string,
  options?: { maxRequests?: number; windowMs?: number; now?: number },
): void {
  const maxRequests = options?.maxRequests ?? DEFAULT_MAX_REQUESTS_PER_WINDOW;
  const windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS;
  const now = options?.now ?? Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStartedAt >= windowMs) {
    buckets.set(key, { count: 1, windowStartedAt: now });
    return;
  }

  if (bucket.count >= maxRequests) {
    throw new Error(`google_rate_limit_exceeded:${key}`);
  }

  bucket.count += 1;
  buckets.set(key, bucket);
}

export function getGoogleRateLimitCount(key: string): number {
  return buckets.get(key)?.count ?? 0;
}
