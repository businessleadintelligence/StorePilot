const STOCKOUT_TOKENS = ["stockout", "reorder", "restock", "supplier", "urgent"];
const OVERSTOCK_TOKENS = ["overstock", "clearance", "markdown", "liquidate"];
const DEAD_TOKENS = ["dead", "stale", "aged", "slow-moving"];

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function clusterKey(input: { category: string; title: string }): string {
  const text = normalizeText(input.title);
  const clusters = [STOCKOUT_TOKENS, OVERSTOCK_TOKENS, DEAD_TOKENS];

  for (const cluster of clusters) {
    if (cluster.some((token) => text.includes(token))) {
      return `${input.category}:${cluster[0]}`;
    }
  }

  return `${input.category}:${text.slice(0, 40)}`;
}

export function areInventoryRecommendationsSimilar(
  left: { category: string; title: string },
  right: { category: string; title: string },
): boolean {
  if (left.category !== right.category) {
    return false;
  }

  return clusterKey(left) === clusterKey(right);
}

export function dedupeSimilarInventoryRecommendations<
  T extends { category: string; title: string; confidence: number; priorityScore?: number },
>(recommendations: T[]): T[] {
  const kept: T[] = [];

  for (const candidate of recommendations) {
    const duplicate = kept.find((existing) => areInventoryRecommendationsSimilar(existing, candidate));
    if (!duplicate) {
      kept.push(candidate);
      continue;
    }

    const candidateScore = candidate.priorityScore ?? candidate.confidence * 100;
    const existingScore = duplicate.priorityScore ?? duplicate.confidence * 100;

    if (candidateScore > existingScore) {
      kept[kept.indexOf(duplicate)] = candidate;
    }
  }

  return kept;
}

export function inventorySimilarityKey(input: { category: string; title: string }): string {
  return clusterKey(input);
}
