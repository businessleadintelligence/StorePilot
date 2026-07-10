export type FoundationCacheEntry<T> = {
  fingerprint: string;
  responseHash: string;
  data: T;
  createdAt: string;
  validUntil: string | null;
};

export type FoundationCacheLookup<T> = {
  hit: boolean;
  entry?: FoundationCacheEntry<T>;
};

export class InMemoryFoundationCache<T = unknown> {
  private readonly entries = new Map<string, FoundationCacheEntry<T>>();

  lookup(fingerprint: string): FoundationCacheLookup<T> {
    const entry = this.entries.get(fingerprint);
    if (!entry) {
      return { hit: false };
    }
    if (entry.validUntil && new Date(entry.validUntil).getTime() <= Date.now()) {
      this.entries.delete(fingerprint);
      return { hit: false };
    }
    return { hit: true, entry };
  }

  store(input: {
    fingerprint: string;
    data: T;
    ttlMs?: number;
    responseHash?: string;
  }): FoundationCacheEntry<T> {
    const createdAt = new Date().toISOString();
    const validUntil =
      input.ttlMs && input.ttlMs > 0
        ? new Date(Date.now() + input.ttlMs).toISOString()
        : null;
    const entry: FoundationCacheEntry<T> = {
      fingerprint: input.fingerprint,
      responseHash: input.responseHash ?? input.fingerprint,
      data: input.data,
      createdAt,
      validUntil,
    };
    this.entries.set(input.fingerprint, entry);
    return entry;
  }

  invalidateByPrefix(prefix: string): number {
    let count = 0;
    for (const key of [...this.entries.keys()]) {
      if (key.startsWith(prefix)) {
        this.entries.delete(key);
        count += 1;
      }
    }
    return count;
  }

  invalidateStore(storeId: string): number {
    return this.invalidateByPrefix(`${storeId}:`);
  }

  size(): number {
    return this.entries.size;
  }
}

export function createFoundationCache<T = unknown>(): InMemoryFoundationCache<T> {
  return new InMemoryFoundationCache<T>();
}
