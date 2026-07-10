import { InMemoryFoundationCache } from "../../../ai/foundation/cache/semantic-cache";
import type { GraphNeighborhood } from "../shared/types";

type CacheKey = string;

const cache = new InMemoryFoundationCache<GraphNeighborhood>();

export function getCachedNeighborhood(key: CacheKey): GraphNeighborhood | null {
  const lookup = cache.lookup(key);
  return lookup.hit && lookup.entry ? lookup.entry.data : null;
}

export function setCachedNeighborhood(
  key: CacheKey,
  neighborhood: GraphNeighborhood,
  ttlMs = 5 * 60 * 1000,
): void {
  cache.store({ fingerprint: key, data: neighborhood, ttlMs });
}

export function invalidateStoreGraphCache(storeId: string): number {
  return cache.invalidateStore(storeId);
}

export function buildNeighborhoodCacheKey(input: {
  storeId: string;
  nodeId: string;
  depth: number;
}): string {
  return `${input.storeId}:graph:neighborhood:${input.nodeId}:${input.depth}`;
}
