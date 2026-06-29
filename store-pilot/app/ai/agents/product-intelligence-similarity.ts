import type { ProductIntelligenceRecommendationDraft } from "../schemas/product-intelligence";

const INVENTORY_TOKENS = ["inventory", "reorder", "restock", "stock", "units", "replenish"];
const BUNDLE_TOKENS = ["bundle", "pair", "kit", "combine"];
const PROMOTION_TOKENS = ["promotion", "promo", "discount", "sale", "campaign"];
const SEO_TOKENS = ["seo", "title", "keyword", "search", "meta"];

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(value: string): Set<string> {
  return new Set(normalizeText(value).split(" ").filter(Boolean));
}

function clusterKey(recommendation: Pick<ProductIntelligenceRecommendationDraft, "category" | "title">): string {
  const tokens = tokenize(recommendation.title);
  const clusters = [
    INVENTORY_TOKENS,
    BUNDLE_TOKENS,
    PROMOTION_TOKENS,
    SEO_TOKENS,
  ];

  for (const cluster of clusters) {
    if (cluster.some((token) => tokens.has(token) || normalizeText(recommendation.title).includes(token))) {
      return `${recommendation.category}:${cluster[0]}`;
    }
  }

  return `${recommendation.category}:${normalizeText(recommendation.title).slice(0, 40)}`;
}

export function areRecommendationsSimilar(
  left: Pick<ProductIntelligenceRecommendationDraft, "category" | "title">,
  right: Pick<ProductIntelligenceRecommendationDraft, "category" | "title">,
): boolean {
  if (left.category !== right.category) {
    return false;
  }

  return clusterKey(left) === clusterKey(right);
}

export function dedupeSimilarRecommendations<T extends ProductIntelligenceRecommendationDraft & { priorityScore?: number }>(
  recommendations: T[],
): T[] {
  const kept: T[] = [];

  for (const candidate of recommendations) {
    const duplicate = kept.find((existing) => areRecommendationsSimilar(existing, candidate));
    if (!duplicate) {
      kept.push(candidate);
      continue;
    }

    const candidateScore = candidate.priorityScore ?? candidate.confidence * 100;
    const existingScore = duplicate.priorityScore ?? duplicate.confidence * 100;

    if (candidateScore > existingScore) {
      const index = kept.indexOf(duplicate);
      kept[index] = candidate;
    }
  }

  return kept;
}

export function similarityClusterKey(
  recommendation: Pick<ProductIntelligenceRecommendationDraft, "category" | "title">,
): string {
  return clusterKey(recommendation);
}
