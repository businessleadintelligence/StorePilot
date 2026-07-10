import type { Prisma } from "@prisma/client";

export type StoreDeletionTransaction = Omit<
  Prisma.TransactionClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Ordered Prisma delegates touched during shop/redact deletion.
 * Used by integration tests to verify GDPR completeness.
 */
export const STORE_DELETION_DELEGATES = [
  "aiRecommendation",
  "aiResultCacheEntry",
  "aiExecutionTelemetry",
  "aiAgentResult",
  "aiAgentRun",
  "aiMemoryRecord",
  "aiCostLedger",
  "aiMerchantBudget",
  "knowledgeGraphSearchIndex",
  "knowledgeGraphEdge",
  "knowledgeGraphRelationship",
  "knowledgeGraphSnapshot",
  "knowledgeGraphVersion",
  "knowledgeGraphNode",
  "knowledgeGraphMetadata",
  "knowledgeGraphIntegrity",
  "knowledgeGraphStatistics",
  "knowledgeGraphBuildCheckpoint",
  "evidenceRelationship",
  "evidenceHistory",
  "evidenceObservation",
  "evidence",
  "evidenceSource",
  "experimentVariant",
  "experimentObservation",
  "experimentResult",
  "experimentWinner",
  "experimentHistory",
  "experimentLearning",
  "experimentConfidence",
  "experimentBaseline",
  "experimentRecommendation",
  "experimentOpportunity",
  "experimentTemplate",
  "experiment",
  "preventionAction",
  "predictionHistory",
  "predictionConfidence",
  "forecastSnapshot",
  "forecastAccuracy",
  "riskAssessment",
  "prediction",
  "forecastModel",
  "businessStability",
  "causalChain",
  "causalTimeline",
  "signalCorrelation",
  "causeConfidence",
  "impactAssessment",
  "causalGraphEdge",
  "rootCauseHistory",
  "rootCauseValidation",
  "rootCause",
  "decisionTask",
  "decisionHistory",
  "decisionScore",
  "executiveBriefing",
  "dailyOperatingPlan",
  "executiveDecision",
  "operationalReadiness",
  "businessContextSnapshot",
  "decisionJournal",
  "decisionTimeline",
  "quickWin",
  "quickWinSummary",
  "learningAttribution",
  "learningHistory",
  "learningSnapshot",
  "businessMemoryVersion",
  "learningPriority",
  "learningVelocity",
  "learningEta",
  "learningReadiness",
  "storeLearningProfile",
  "historicalSnapshot",
  "patternSeed",
  "confidenceSeed",
  "merchantBaseline",
  "businessDnaVersion",
  "historicalMemory",
  "knowledgeSyncCheckpoint",
  "knowledgeReadiness",
  "merchantDecision",
  "merchantFeedback",
  "adaptiveMemory",
  "recommendationOutcome",
  "predictionAccuracyRecord",
  "predictionValidation",
  "merchantPreference",
  "merchantBehaviorProfile",
  "personalizationProfile",
  "adaptiveConfidence",
  "adaptiveScore",
  "merchantTimeline",
  "jobEvent",
  "storeOnboarding",
  "syncJob",
  "orderLineItem",
  "order",
  "product",
  "webhookEvent",
  "usageRecord",
  "subscription",
  "customerDataExport",
  "googleIntegration",
  "microsoftClarityIntegration",
  "user",
] as const;

export type StoreDeletionDelegate = (typeof STORE_DELETION_DELEGATES)[number];

/**
 * Deletes every store-scoped row in FK-safe order inside an existing transaction.
 * Must run before `store.delete()` to satisfy Restrict foreign keys.
 */
export async function deleteAllStoreDataInTransaction(
  tx: StoreDeletionTransaction,
  storeId: string,
): Promise<void> {
  const where = { storeId };

  await tx.aiRecommendation.deleteMany({ where });
  await tx.aiResultCacheEntry.deleteMany({ where });
  await tx.aiExecutionTelemetry.deleteMany({ where });
  await tx.aiAgentResult.deleteMany({ where });
  await tx.aiAgentRun.deleteMany({ where });
  await tx.aiMemoryRecord.deleteMany({ where });
  await tx.aiCostLedger.deleteMany({ where });
  await tx.aiMerchantBudget.deleteMany({ where });

  await tx.knowledgeGraphSearchIndex.deleteMany({ where });
  await tx.knowledgeGraphEdge.deleteMany({ where });
  await tx.knowledgeGraphRelationship.deleteMany({ where });
  await tx.knowledgeGraphSnapshot.deleteMany({ where });
  await tx.knowledgeGraphVersion.deleteMany({ where });
  await tx.knowledgeGraphNode.deleteMany({ where });
  await tx.knowledgeGraphMetadata.deleteMany({ where });
  await tx.knowledgeGraphIntegrity.deleteMany({ where });
  await tx.knowledgeGraphStatistics.deleteMany({ where });
  await tx.knowledgeGraphBuildCheckpoint.deleteMany({ where });

  await tx.evidenceRelationship.deleteMany({ where });
  await tx.evidenceHistory.deleteMany({ where });
  await tx.evidenceObservation.deleteMany({ where });
  await tx.evidence.deleteMany({ where });
  await tx.evidenceSource.deleteMany({ where });

  await tx.experimentVariant.deleteMany({ where });
  await tx.experimentObservation.deleteMany({ where });
  await tx.experimentResult.deleteMany({ where });
  await tx.experimentWinner.deleteMany({ where });
  await tx.experimentHistory.deleteMany({ where });
  await tx.experimentLearning.deleteMany({ where });
  await tx.experimentConfidence.deleteMany({ where });
  await tx.experimentBaseline.deleteMany({ where });
  await tx.experimentRecommendation.deleteMany({ where });
  await tx.experimentOpportunity.deleteMany({ where });
  await tx.experimentTemplate.deleteMany({ where });
  await tx.experiment.deleteMany({ where });

  await tx.preventionAction.deleteMany({ where });
  await tx.predictionHistory.deleteMany({ where });
  await tx.predictionConfidence.deleteMany({ where });
  await tx.forecastSnapshot.deleteMany({ where });
  await tx.forecastAccuracy.deleteMany({ where });
  await tx.riskAssessment.deleteMany({ where });
  await tx.prediction.deleteMany({ where });
  await tx.forecastModel.deleteMany({ where });
  await tx.businessStability.deleteMany({ where });

  await tx.causalChain.deleteMany({ where });
  await tx.causalTimeline.deleteMany({ where });
  await tx.signalCorrelation.deleteMany({ where });
  await tx.causeConfidence.deleteMany({ where });
  await tx.impactAssessment.deleteMany({ where });
  await tx.causalGraphEdge.deleteMany({ where });
  await tx.rootCauseHistory.deleteMany({ where });
  await tx.rootCauseValidation.deleteMany({ where });
  await tx.rootCause.deleteMany({ where });

  await tx.decisionTask.deleteMany({ where });
  await tx.decisionHistory.deleteMany({ where });
  await tx.decisionScore.deleteMany({ where });
  await tx.executiveBriefing.deleteMany({ where });
  await tx.dailyOperatingPlan.deleteMany({ where });
  await tx.executiveDecision.deleteMany({ where });
  await tx.operationalReadiness.deleteMany({ where });
  await tx.businessContextSnapshot.deleteMany({ where });
  await tx.decisionJournal.deleteMany({ where });
  await tx.decisionTimeline.deleteMany({ where });

  await tx.quickWin.deleteMany({ where });
  await tx.quickWinSummary.deleteMany({ where });

  await tx.learningAttribution.deleteMany({ where });
  await tx.learningHistory.deleteMany({ where });
  await tx.learningSnapshot.deleteMany({ where });
  await tx.businessMemoryVersion.deleteMany({ where });
  await tx.learningPriority.deleteMany({ where });
  await tx.learningVelocity.deleteMany({ where });
  await tx.learningEta.deleteMany({ where });
  await tx.learningReadiness.deleteMany({ where });
  await tx.storeLearningProfile.deleteMany({ where });
  await tx.historicalSnapshot.deleteMany({ where });
  await tx.patternSeed.deleteMany({ where });
  await tx.confidenceSeed.deleteMany({ where });
  await tx.merchantBaseline.deleteMany({ where });
  await tx.businessDnaVersion.deleteMany({ where });
  await tx.historicalMemory.deleteMany({ where });
  await tx.knowledgeSyncCheckpoint.deleteMany({ where });
  await tx.knowledgeReadiness.deleteMany({ where });

  await tx.merchantDecision.deleteMany({ where });
  await tx.merchantFeedback.deleteMany({ where });
  await tx.adaptiveMemory.deleteMany({ where });
  await tx.recommendationOutcome.deleteMany({ where });
  await tx.predictionAccuracyRecord.deleteMany({ where });
  await tx.predictionValidation.deleteMany({ where });
  await tx.merchantPreference.deleteMany({ where });
  await tx.merchantBehaviorProfile.deleteMany({ where });
  await tx.personalizationProfile.deleteMany({ where });
  await tx.adaptiveConfidence.deleteMany({ where });
  await tx.adaptiveScore.deleteMany({ where });
  await tx.merchantTimeline.deleteMany({ where });

  await tx.jobEvent.deleteMany({ where });
  await tx.storeOnboarding.deleteMany({ where });
  await tx.syncJob.deleteMany({ where });
  await tx.orderLineItem.deleteMany({ where });
  await tx.order.deleteMany({ where });
  await tx.product.deleteMany({ where });
  await tx.webhookEvent.deleteMany({ where });
  await tx.usageRecord.deleteMany({ where });
  await tx.subscription.deleteMany({ where });
  await tx.customerDataExport.deleteMany({ where });
  await tx.googleIntegration.deleteMany({ where });
  await tx.microsoftClarityIntegration.deleteMany({ where });
  await tx.user.deleteMany({ where });
}
