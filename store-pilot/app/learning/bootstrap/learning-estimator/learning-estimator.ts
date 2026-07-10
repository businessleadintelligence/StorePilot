import type { StoreSizeTier } from "@prisma/client";

import {
  AI_COST_USD_PER_1K_PRODUCTS,
  BASE_BOOTSTRAP_MINUTES,
  GRAPH_BUILD_MINUTES_PER_1K_PRODUCTS,
  ORDERS_PER_MINUTE,
  PRODUCTS_PER_MINUTE,
  QUICK_WIN_BASE_MINUTES,
} from "../../shared/constants";
import type { LearningDurationEstimate, StoreCatalogSnapshot } from "../../shared/types";

export function estimateLearningDurations(input: {
  snapshot: StoreCatalogSnapshot;
  storeSize: StoreSizeTier;
}): LearningDurationEstimate {
  const { snapshot, storeSize } = input;
  const sizeMultiplier = storeSizeMultiplier(storeSize);

  const historicalImportMinutes = Math.max(
    5,
    Math.ceil(snapshot.productsCount / PRODUCTS_PER_MINUTE) +
      Math.ceil(snapshot.ordersCount / ORDERS_PER_MINUTE),
  );
  const graphBuildMinutes = Math.max(
    3,
    Math.ceil((snapshot.productsCount / 1000) * GRAPH_BUILD_MINUTES_PER_1K_PRODUCTS),
  );
  const quickWinMinutes = QUICK_WIN_BASE_MINUTES + Math.ceil(snapshot.productsCount / 2000);
  const bootstrapDurationMinutes = BASE_BOOTSTRAP_MINUTES;
  const workerEstimateMinutes = Math.ceil(
    (historicalImportMinutes + graphBuildMinutes + quickWinMinutes) * sizeMultiplier,
  );
  const totalEstimatedMinutes = Math.ceil(
    bootstrapDurationMinutes + workerEstimateMinutes,
  );
  const futureAiCostEstimateUsd = round(
    (snapshot.productsCount / 1000) * AI_COST_USD_PER_1K_PRODUCTS * (1 + sizeMultiplier * 0.2),
    4,
  );

  return {
    bootstrapDurationMinutes,
    historicalImportMinutes,
    graphBuildMinutes,
    quickWinMinutes,
    totalEstimatedMinutes,
    workerEstimateMinutes,
    futureAiCostEstimateUsd,
  };
}

function storeSizeMultiplier(storeSize: StoreSizeTier): number {
  switch (storeSize) {
    case "tiny":
      return 0.8;
    case "small":
      return 1;
    case "medium":
      return 1.2;
    case "large":
      return 1.45;
    case "enterprise":
      return 1.75;
    default:
      return 1;
  }
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
