export function trendSimilarityKey(input: { category: string; title: string }): string {
  return `${input.category}:${input.title.toLowerCase().trim().slice(0, 48)}`;
}

export function areTrendRecommendationsSimilar(
  left: { category: string; title: string },
  right: { category: string; title: string },
): boolean {
  if (left.category !== right.category) return false;
  return trendSimilarityKey(left) === trendSimilarityKey(right);
}

export function dedupeSimilarTrendRecommendations<
  T extends { category: string; title: string; confidence: number; priorityScore?: number },
>(recommendations: T[]): T[] {
  const kept: T[] = [];
  for (const candidate of recommendations) {
    const duplicate = kept.find((existing) => areTrendRecommendationsSimilar(existing, candidate));
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
