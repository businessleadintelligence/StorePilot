import type { StoreSyncAdminClient } from "../../services/store.server";
import { classifyStoreSize, estimateCatalogComplexity } from "./catalog-estimator/catalog-estimator";
import { estimateLearningDurations } from "./learning-estimator/learning-estimator";
import { buildLearningPriorities } from "./learning-prioritizer/learning-prioritizer";
import { collectStoreCatalogSnapshot } from "./store-profiler/store-profiler";
import {
  markBootstrapFailed,
  markBootstrapRunning,
  persistBootstrapIntelligence,
} from "./bootstrap-intelligence";
import { buildLearningEta } from "../eta/learning-eta";
import {
  assignLearningVelocities,
  buildMerchantMessage,
  buildStageExplanation,
  computeInitialConfidences,
  computeOverallConfidence,
  resolveBootstrapStage,
} from "../readiness/initial-confidence";
import type { BootstrapIntelligenceResult } from "../shared/types";

export async function runBootstrapIntelligence(input: {
  storeId: string;
  admin: StoreSyncAdminClient;
}): Promise<BootstrapIntelligenceResult> {
  await markBootstrapRunning(input.storeId);

  try {
    const snapshot = await collectStoreCatalogSnapshot(input.admin);
    const storeSize = classifyStoreSize(snapshot.productsCount);
    const scores = estimateCatalogComplexity(snapshot);
    const duration = estimateLearningDurations({ snapshot, storeSize });
    const confidences = computeInitialConfidences({ snapshot, scores });
    const overallConfidencePercent = computeOverallConfidence(confidences);
    const velocities = assignLearningVelocities(confidences);
    const priorities = buildLearningPriorities();
    const stage = resolveBootstrapStage();
    const historyMonthsDisplay = snapshot.estimatedHistoryMonths;
    const eta = buildLearningEta({ duration, historyMonthsDisplay });
    const merchantHeadline = eta.merchantHeadline;
    const merchantMessage = buildMerchantMessage({
      historyMonthsDisplay,
      totalEstimatedMinutes: duration.totalEstimatedMinutes,
      overallConfidencePercent,
    });
    const stageExplanation = buildStageExplanation(stage);

    const result: BootstrapIntelligenceResult = {
      storeId: input.storeId,
      storeSize,
      snapshot,
      scores,
      duration,
      confidences,
      overallConfidencePercent,
      stage,
      velocities,
      priorities,
      merchantHeadline,
      merchantMessage,
      stageExplanation,
      historyMonthsDisplay,
    };

    await persistBootstrapIntelligence(result);
    return result;
  } catch (error) {
    await markBootstrapFailed(input.storeId);
    throw error;
  }
}
