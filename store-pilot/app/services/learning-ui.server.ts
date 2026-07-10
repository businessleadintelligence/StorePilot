import { getLearningReadinessForUi } from "../learning/api/learning-api";
import type { LearningReadinessUiData } from "../learning/shared/types";

export type { LearningReadinessUiData };

export async function getLearningBootstrapForUi(
  storeId: string,
  onboardingPhase?: {
    products?: string;
    inventory?: string;
    orders?: string;
  },
): Promise<LearningReadinessUiData | null> {
  return getLearningReadinessForUi(storeId, onboardingPhase);
}
