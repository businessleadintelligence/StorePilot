import { buildRequestFingerprint, hashObject } from "../utils/hash";
import {
  createFoundationCache,
  InMemoryFoundationCache,
  type FoundationCacheLookup,
} from "./semantic-cache";

export type FoundationCacheServiceOptions = {
  defaultTtlMs?: number;
  cache?: InMemoryFoundationCache;
};

export class FoundationCacheService {
  private readonly cache: InMemoryFoundationCache;
  private readonly defaultTtlMs: number;

  constructor(options: FoundationCacheServiceOptions = {}) {
    this.cache = options.cache ?? createFoundationCache();
    this.defaultTtlMs = options.defaultTtlMs ?? 15 * 60 * 1000;
  }

  buildFingerprint(input: {
    storeId: string;
    feature: string;
    subjectKey?: string;
    promptHash: string;
    variables?: Record<string, unknown>;
  }): string {
    return buildRequestFingerprint({
      storeId: input.storeId,
      feature: input.feature,
      subjectKey: input.subjectKey,
      promptHash: input.promptHash,
      variablesHash: hashObject(input.variables ?? {}),
    });
  }

  lookup<T>(fingerprint: string): FoundationCacheLookup<T> {
    return this.cache.lookup(fingerprint) as FoundationCacheLookup<T>;
  }

  store<T>(input: {
    fingerprint: string;
    data: T;
    ttlMs?: number;
  }): void {
    this.cache.store({
      fingerprint: input.fingerprint,
      data: input.data,
      ttlMs: input.ttlMs ?? this.defaultTtlMs,
      responseHash: hashObject(input.data),
    });
  }

  invalidateStore(storeId: string): number {
    return this.cache.invalidateStore(storeId);
  }

  invalidateForWebhook(storeId: string, topic: string): number {
    return this.cache.invalidateByPrefix(`${storeId}:${topic}`);
  }
}

export function createFoundationCacheService(
  options?: FoundationCacheServiceOptions,
): FoundationCacheService {
  return new FoundationCacheService(options);
}
