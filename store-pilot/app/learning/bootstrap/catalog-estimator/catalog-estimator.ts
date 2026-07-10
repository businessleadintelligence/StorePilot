import type { StoreSizeTier } from "@prisma/client";

import { STORE_SIZE_THRESHOLDS } from "../../shared/constants";
import type { StoreCatalogSnapshot, StoreComplexityScores } from "../../shared/types";

export function classifyStoreSize(productsCount: number): StoreSizeTier {
  if (productsCount <= STORE_SIZE_THRESHOLDS.tiny.maxProducts) {
    return "tiny";
  }
  if (productsCount <= STORE_SIZE_THRESHOLDS.small.maxProducts) {
    return "small";
  }
  if (productsCount <= STORE_SIZE_THRESHOLDS.medium.maxProducts) {
    return "medium";
  }
  if (productsCount <= STORE_SIZE_THRESHOLDS.large.maxProducts) {
    return "large";
  }
  return "enterprise";
}

export function estimateCatalogComplexity(snapshot: StoreCatalogSnapshot): StoreComplexityScores {
  const catalogComplexityScore = clamp01(
    Math.log10(snapshot.productsCount + 1) / 4 +
      Math.log10(snapshot.variantsCount + 1) / 5 +
      snapshot.averageVariantsPerProduct / 20 +
      snapshot.uniqueTagsCount / 500,
  );

  const historicalDepthScore = clamp01(
    snapshot.estimatedHistoryMonths / 24 + Math.log10(snapshot.ordersCount + 1) / 6,
  );

  const operationalComplexityScore = clamp01(
    snapshot.locationsCount / 10 +
      snapshot.vendorsCount / 50 +
      snapshot.collectionsCount / 100 +
      catalogComplexityScore * 0.35,
  );

  return {
    catalogComplexityScore: round(catalogComplexityScore, 4),
    historicalDepthScore: round(historicalDepthScore, 4),
    operationalComplexityScore: round(operationalComplexityScore, 4),
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
