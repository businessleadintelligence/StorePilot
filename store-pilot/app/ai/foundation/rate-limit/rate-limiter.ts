export type RateLimitDecision = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

export type TokenBucketOptions = {
  capacity: number;
  refillRatePerSecond: number;
};

export class TokenBucketRateLimiter {
  private tokens: number;
  private lastRefillAt = Date.now();

  constructor(private readonly options: TokenBucketOptions) {
    this.tokens = options.capacity;
  }

  consume(tokens = 1): RateLimitDecision {
    this.refill();
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return {
        allowed: true,
        remaining: Math.floor(this.tokens),
        retryAfterMs: 0,
      };
    }

    const deficit = tokens - this.tokens;
    const retryAfterMs = Math.ceil(
      (deficit / this.options.refillRatePerSecond) * 1000,
    );
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs,
    };
  }

  private refill(): void {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefillAt) / 1000;
    if (elapsedSeconds <= 0) {
      return;
    }
    this.tokens = Math.min(
      this.options.capacity,
      this.tokens + elapsedSeconds * this.options.refillRatePerSecond,
    );
    this.lastRefillAt = now;
  }
}

export function createDefaultRateLimiter(): TokenBucketRateLimiter {
  return new TokenBucketRateLimiter({
    capacity: 20,
    refillRatePerSecond: 2,
  });
}
