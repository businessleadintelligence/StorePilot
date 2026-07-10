import {
  getBusinessStability,
  getPredictionUiItems,
  getTopRiskPredictions,
} from "../prediction/api/prediction-api";
import type { PredictionUiItem } from "../prediction/shared/types";

export type PredictionDashboardUiData = {
  businessStabilityScore: number;
  items: PredictionUiItem[];
  topRisks: PredictionUiItem[];
};

export async function getPredictionDashboardForUi(
  storeId: string,
): Promise<PredictionDashboardUiData | null> {
  const [stability, items, topRisks] = await Promise.all([
    getBusinessStability(storeId),
    getPredictionUiItems(storeId),
    getTopRiskPredictions(storeId),
  ]);

  if (!stability && items.length === 0) {
    return null;
  }

  return {
    businessStabilityScore: stability?.score ?? 0,
    items,
    topRisks,
  };
}
