import { areGrowthRecommendationsSimilar } from "./growth-similarity-tool";

export function dedupeSimilarExecutiveCooRecommendations<
  T extends { category: string; title: string; confidence: number; priorityScore?: number },
>(recommendations: T[]): T[] {
  const kept: T[] = [];
  for (const candidate of recommendations) {
    const duplicate = kept.find((existing) => areGrowthRecommendationsSimilar(existing, candidate));
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
