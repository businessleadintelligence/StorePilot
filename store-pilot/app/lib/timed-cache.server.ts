export type TimedCacheEntry<T> = {
  expiresAt: number;
  value: T;
};

export class TimedCache<T> {
  private readonly store = new Map<string, TimedCacheEntry<T>>();

  constructor(private readonly defaultTtlMs: number) {}

  get(key: string, now = Date.now()): T | null {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt <= now) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlMs = this.defaultTtlMs, now = Date.now()): void {
    this.store.set(key, { value, expiresAt: now + ttlMs });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

export async function getOrComputeCached<T>(
  cache: TimedCache<T>,
  key: string,
  compute: () => Promise<T>,
  ttlMs?: number,
): Promise<T> {
  const cached = cache.get(key);
  if (cached !== null) {
    return cached;
  }
  const value = await compute();
  cache.set(key, value, ttlMs);
  return value;
}
