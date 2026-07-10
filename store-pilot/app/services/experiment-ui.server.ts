import {
  getExperimentRecommendations,
  getExperimentUiItems,
} from "../experiments/api/experiment-api";
import type { ExperimentUiItem } from "../experiments/shared/types";

export type ExperimentDashboardUiData = {
  items: ExperimentUiItem[];
  recommendationCount: number;
};

export async function getExperimentDashboardForUi(
  storeId: string,
): Promise<ExperimentDashboardUiData | null> {
  const [items, recommendations] = await Promise.all([
    getExperimentUiItems(storeId),
    getExperimentRecommendations(storeId),
  ]);

  if (items.length === 0 && recommendations.length === 0) {
    return null;
  }

  return {
    items,
    recommendationCount: recommendations.length,
  };
}
